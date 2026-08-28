# 本次工程修复说明

只动工程问题,没有新增功能,现有接口与前端行为保持兼容。

---

## 一、数据安全(最严重的一处)

### 问题
`models_db / fin_db / ds_db / cloud_db / storage_db` 五个模块的写入是
`fs.writeFileSync(FILE, json)` —— 直接覆盖原文件,不是原子操作(只有 `db.js` 用了 tmp+rename)。

于是有这样一条链路:

1. 进程在写入途中被杀(Railway 重启 / 部署 / OOM)→ 文件被截断成半个 JSON;
2. 下次 `load()` 的 `catch` 吞掉解析错误,返回 `{ models: [], ... }`;
3. 紧接着任何一次 `save()` 就把这个空对象写回磁盘。

结果:手工维护的车型库、财务库**全部消失,且没有任何报错**,`updatedAt` 还是正常的。

### 修复
新增 `src/store.js` 作为统一存储层,六个库(含 `db.js`)全部接入:

- 写入走 `tmp → fsync → rename`,`rename` 在同一文件系统上是原子的;
- 每次覆盖前把当前文件复制为 `<file>.bak`;
- 读取时主文件解析失败 → 自动回退 `.bak`(会丢最近一次写入,日志告警);
- 主文件和 `.bak` 都坏 → 把主文件另存为 `<file>.corrupt-<时间戳>`,并**锁定该文件的写入**:
  读取返回空结构让服务继续跑,但任何写入直接抛错,不会用空数据覆盖掉还有救的内容。
  `/api/health` 的 `ok` 变成 `false`,`lockedStores` 列出问题文件。
- 应急:确认放弃旧数据时,设 `STORE_FORCE_RESET=1` 启动一次,从空数据重建。

已验证:截断文件后重启 → 从 `.bak` 恢复;两份都坏 → 隔离 + 锁定 + 写入返回 500 且损坏文件原样保留。

---

## 二、访问控制(省钱 + 防改数据)

### 问题
所有接口零鉴权。拿到部署域名就能:

- `POST /api/refresh` → 触发全量 LLM 抓取,烧 DeepSeek / 博查额度
- `DELETE /api/models/:id` → 删掉手工维护的车型
- `PUT /api/fin/quarterly/:id` → 改财务数据

### 修复
新增 `src/guard.js`,挂在 `app.use("/api", apiGuard)`:

- `GET` 一律公开(这是个对外资讯站);
- 写操作 + 会打外部付费接口的 `GET /api/fin/em-probe` 需要请求头 `x-admin-token`;
- `/api/detail`、`/api/subscribe` 保持公开(终端用户功能),但按 IP 限流
  (detail 30 次/分,subscribe 5 次/分);
- 抓取类任务加最短触发间隔 `JOB_MIN_GAP_MS`(默认 60 秒),防连点;
- **兼容**:未设置 `ADMIN_TOKEN` 时放行并在启动日志告警,不会让现有部署突然全挂;设置后立即生效。

前端新增 `public/api-auth.js`:包装 `window.fetch`,自动给 `/api` 的写请求带上令牌头,
401 时弹框提示填写。这样不用改散落在 5 个前端文件里的几十处 `fetch` 调用。
顶栏右上角加了「🔑」按钮,令牌存 localStorage。

---

## 三、定时任务漏排

`cron.js` 里这一行:

```js
cron.schedule("10 8 1 * *", () => seedModels()..., ...);
// 日志却打印「每月1号08:10 上市节奏」
```

`refreshCadence` 定义了、导出了、在 `/api/refresh` 的 RUNNERS 里也挂了,
**但从来没有被 cron 排程过**。所以上市节奏(`cad_*` 快照)只在首次请求时懒生成一次,
之后永远不再刷新 —— 2026 上市规划的数据会一直停在生成那天。

已补上 `每月 1 号 08:40 refreshCadence`,并把日志文案改成和实际排程一致。

---

## 四、出站请求没有超时

`node` 的 `fetch` 默认无超时。博查 / Google News / 东方财富 / DeepSeek 任何一个挂起,
定时任务就一直卡着 —— 日报不生成、`jobs[key]` 永远停在 `running`(前端一直转圈),
而且没有任何日志。

新增 `src/http.js` 的 `fetchWithTimeout`,所有出站请求接入:
`HTTP_TIMEOUT_MS` 默认 20 秒,大模型单独用 `LLM_TIMEOUT_MS` 默认 120 秒。

---

## 五、串行检索改并发

日报生成里 7 个博查查询 + 5 个 Google News 查询全是串行 `for` 循环,一次要串起十几个 RTT。
`research()` 里同样是串行(上市节奏每个品牌 10 个查询)。

新增 `src/pool.js`(并发限流,结果保序),接入三处:

- `claude.js getNews()`:博查 4 并发,且与 Google News 两路 `Promise.all` 同时跑;
- `research.js`:博查查询 4 并发;
- `news_rss.js googleNewsItems()`:4 并发。

顺带把 `cadence.js` / `models_seed.js` / `fin_seed.js` 里三份重复的 `pool` 实现合并掉。

---

## 六、其他

| 项 | 说明 |
| --- | --- |
| 删 `src/prompts.js` | 全项目零引用的死代码(`claude.js` 自己拼 schema,从没用过它) |
| 日报归档裁剪 | `data.json` 的 `digests` 此前无限增长;现按 `DIGEST_KEEP_DAYS`(默认 180 天)自动裁 |
| 全局错误兜底 | 路由里未捕获的异常此前会落到 express 默认处理器返回 HTML 堆栈;改为返回 JSON |
| `trust proxy` | Railway 前面有反代,限流需要真实 IP |
| `/api/health` 增强 | 增加 `adminToken` 是否配置、`lockedStores` 损坏文件列表 |
| 补 `.env.example` | README 提到但压缩包里没有,顺带把新增变量都写上 |
| 补 `.gitignore` | 之前没有,`data.json` 等运行时文件有被误提交的风险 |
| 前端页脚文案 | 写的是「通过 Anthropic API 联网检索」,与实际(博查 + DeepSeek)不符,已改 |

---

## 部署前需要做的

1. 生成并设置 `ADMIN_TOKEN`:
   ```
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```
   填进 Railway 环境变量,然后在网页右上角「🔑」输入同一个值。
2. 确认 `DB_PATH=/data/data.json` 且 /data 卷已挂载(六个数据文件都会落在 /data)。
3. 部署后访问 `/api/health`,确认 `adminToken` 是「已配置」、`lockedStores` 为空。

## 新增/修改文件

```
新增  src/store.js        存储层:原子写入 / 备份 / 损坏锁定
新增  src/guard.js        令牌校验 / 限流 / 任务最短间隔
新增  src/http.js         带超时的 fetch
新增  src/pool.js         并发限流
新增  public/api-auth.js  前端令牌注入
新增  .env.example  .gitignore  CHANGES.md
删除  src/prompts.js      死代码
修改  server.js  README.md
修改  src/db.js  models_db.js  fin_db.js  ds_db.js  cloud_db.js  storage_db.js
修改  src/cron.js  claude.js  research.js  news_rss.js  llm.js  search.js  fin_em.js  mailer.js
修改  src/cadence.js  models_seed.js  fin_seed.js
修改  public/index.html
```

---

## 补丁：不设 ADMIN_TOKEN 时的兜底（追加）

上面的「任务最短间隔」有个漏洞：`seed-brand` / `seed-company` 的间隔键是
`"brand:" + 用户传的字符串`，**换个字符串就是新键，间隔形同虚设**。而
`seedOneBrand()` 对品牌名不做任何校验 —— 传任意字符串都会跑一轮
（3 次博查 + 1 次 Google News + 一次 5000 token 的 DeepSeek），
并把模型编出来的内容以该名字写进 `models.json`。

不设 `ADMIN_TOKEN` 的话，这就是个**没有上限的烧钱接口 + 数据投毒入口**。已补：

- **全局抓取预算**（与键无关）：所有抓取类任务合计 `JOB_MAX_PER_HOUR` 次/小时，
  默认 20。轮换字符串也绕不过去。`/api/health` 的 `jobBudgetLeft` 可以看余量。
- **输入清洗** `cleanName()`：品牌名/车企名限长 30 字、去换行后才拼进检索词和提示词，
  堵掉撑 token 和往提示词里塞指令两条路。
- **公开 GET 也限流**：`/api/brand-market` 每个没见过的品牌名都会触发一次 LLM 小结，
  加了 20 次/分/IP；`/api/detail` 从 30 次/分收紧到 12 次/分（每次要打 2 次博查 + 1 次 LLM）。
- `tooSoon` 的键表加了容量上限，避免用户输入把内存撑爆。

**结论**：现在即使完全不设 `ADMIN_TOKEN`，最坏情况也被压到「每小时 20 次抓取任务」，
成本可控。但**改数据/删车型仍然对全网开放**，这条只有令牌能挡。

---

## `/api/health` 增加 storage 段（追加）

部署后用来一眼确认数据到底落在哪：

```json
"storage": {
  "persistent": true,          // false = DB_PATH 没设，数据在容器临时盘，下次部署就没了
  "dir": "/data",
  "files": [{ "name": "models.json", "kb": 240.5, "mtime": "..." }]
}
```

`persistent: false` 是个必须立刻处理的信号。`mtime` 用来确认重新部署之后数据文件
是原来那份、而不是重新生成的空文件。

---

# 第二轮:日报生成的可靠性

## 问题

`/api/news/archive` 显示 2026-06-17 ~ 08-21 的 66 天里缺了 10 天,失败率 15%:

- `08-01 ~ 08-05` 连续 5 天
- `07-19 ~ 07-21` 连续 3 天
- `08-10`、`08-14` 各一天

连续多天断档不像网络抖动,更像配额耗尽 / 密钥失效 / 上游长时间故障。而原来的
`generateDaily` **失败就是失败了** —— 不重试、不补、不告警,只在日志留一行,
Railway 日志一滚就再也查不到当时为什么失败。

## 一、失败重试

`generateDigestFor()`:指数退避 20s → 40s,默认重试 2 次(`DIGEST_RETRY_MAX`)。

重点是**跟 `http.js` 的超时配合、不叠加成超长阻塞**。`fetchWithTimeout` 限的是**单个请求**,
而一次日报生成内部有 7 次博查 + 5 次 Google News,再加 `chatJSON` 的 3 级兜底
(每级各一个 `LLM_TIMEOUT_MS` = 120s)—— 单次尝试最坏能到 6 分钟以上,再乘以重试次数
就是小时级阻塞。所以在请求级超时之上加了两道闸:

| 参数 | 默认 | 管什么 |
| --- | --- | --- |
| `DIGEST_ATTEMPT_TIMEOUT_MS` | 240s | 一次尝试的上限 |
| `DIGEST_RETRY_DEADLINE_MS` | 600s | 整轮重试(含退避等待)的上限 |

每次重试前先算剩余预算,不够再跑一次就直接收手。**默认参数下最坏总耗时正好 10 分钟**
(实测三次尝试分别在 0s / 260s / 540s 发起,最后一次被剩余预算压到 60s)。

两个坑:

- 单次尝试超时后,底层 fetch 是取消不掉的(只有 `http.js` 里的 AbortController 能取消)。
  所以用 `token.cancelled` 标记,**迟到的结果不许再写库** —— 否则会覆盖掉后来重试成功的那份。
- 算「单次尝试上限」时不能给剩余预算兜一个下限(`Math.max(30_000, leftMs)`),
  那等于允许最后一次尝试冲破 deadline。这个写错过,实测跑到了 61s / 78s(deadline 60s),
  已修正。

## 二、补漏

`backfillDigests()`,在**启动后 15 秒**和**每天日报任务结束后**各跑一次,
检查最近 `DIGEST_BACKFILL_DAYS`(默认 14)天有没有缺的日期,从最近的往前补。

光有重试挡不住连缺 5 天(当天重试多少次都没用),光有补漏也不划算(抖动本可以当场救回来),
两层都要。

成本上限(补一天 = 7 次博查 + 一次 DeepSeek,必须卡死):

- 单轮最多补 `DIGEST_BACKFILL_MAX`(默认 3)天,剩下的留给下一轮;
- **每补一天前调 `guard.js` 的 `overBudget()` 扣全局预算**,没额度就停,不绕过;
- `DIGEST_BACKFILL=0` 整个关掉;
- 补漏的重试收敛到 1 次(`DIGEST_BACKFILL_RETRY`)—— 历史日报不值得反复烧钱。

**补出来的日报做了标记**,不与当天正常生成的混同:归档记录里 `source: "backfill"`,
日报内容里 `backfilled: true` + `backfilled_at`。

这个标记不是形式上的。检索接口只能搜"现在搜得到的",补 3 周前的日报**拿不回那天的
实时新闻流**。代码里能做的只有:博查窗口从 `oneDay` 放宽到 `oneMonth`、**跳过 Google News**
(它只有最近两天,拉回来只会把今天的新闻混进历史日报)、提示词里锁死目标日期并要求
"宁可少给几条也不要用更晚的新闻凑数"。补出来的质量必然不如当天生成,所以要能一眼区分。

另外,**补出来的历史日报不做车型库增量更新** —— 那份内容时间上混杂,拿去改 `models.json`
只会污染手工维护的数据。

生成和补漏共用一把串行锁:两者都烧额度、都写 `data.json`,不能并发。

## 三、失败留痕

最终仍失败的,把**日期 + 错误原文 + 尝试次数 + 是日常还是补漏**写进 `data.json` 的
`digestFailures`(环形缓冲,保留最近 `DIGEST_FAILURE_KEEP` 条,默认 50;错误信息截 500 字)。
写入走 `db.js` → `store.js`,没有绕过存储层。

`/api/health` 的 `digestFailures` 直接能看,`?failures=50` 可以多看几条。
某天后来被补上了,对应的失败记录会标 `resolvedAt`(**保留痕迹,不删**)。

留痕本身用 try/catch 包住:`data.json` 被 store 锁定时写入会抛错,不能让留痕失败把
原始错误盖掉。

## 四、`/api/health` 增加 startedAt / uptime

```json
"startedAt": "2026-08-22T00:31:07.412Z",
"startedAtLocal": "2026/8/22 08:31:07",
"uptimeSec": 11530,
"uptime": "3 小时 12 分"
```

由 `process.uptime()` 反推,比模块加载时刻准。**改完环境变量对一下这个时间**:
如果 `startedAt` 早于你改配置的时刻,那就是压根没重启,而不是配置写错了。

顺带加了 `digest` 段:今天生成了没、最近 14 天还缺哪几天(`missingRecent`)、
上一轮补漏干了什么(`lastBackfill`,含中途停手的原因)。

## 向后兼容

- `data.json` 结构没改,只加了一个顶层键 `digestFailures`。老文件里没有这个键,
  靠 `db.js` 里 `{ ...blank(), ...readStore(FILE, blank) }` 的展开顺序自动补上,**不需要迁移**。
- 归档记录只在**补漏**时才写 `source` 字段,当天正常生成的记录形状和历史数据完全一致。
- `listDigests()` 对老记录返回 `source: "daily"`。前端不用改。
- `generateDaily()` 的对外签名和行为不变(仍是生成 + 返回日报数据,失败抛错)。

## 新增接口

```
POST /api/news/backfill    手动触发一轮补漏(需要 ADMIN_TOKEN)
```

平时用不到 —— 启动时和每天日报后会自动跑。这个口子是给"刚修好上游、不想等到明早"用的。
预算和单轮上限仍由 `backfillDigests` 内部把关,没有为它开后门。

## 关于历史上那 10 天

按默认的 14 天窗口,**只有 `08-14` 和 `08-10` 会被自动补上** —— 8 月初那 5 连缺和 7 月那 3 天
已经超出窗口。要把它们也补回来,临时把 `DIGEST_BACKFILL_DAYS` 调到 40 左右再重启,
或者调几次 `POST /api/news/backfill`(单轮仍只补 3 天,需要跑几轮)。补完记得调回 14。

## 修改文件

```
新增  CLAUDE.md            项目架构 / 数据流 / 模块职责 / 必须遵守的约定
修改  src/cron.js          重试 / 补漏 / 串行锁 / 失败留痕(本轮主要改动)
修改  src/db.js            digestFailures + 归档来源标记 + digestIsoSet
修改  src/claude.js        getNews 支持目标日期(补漏模式:放宽窗口、跳过 Google News)
修改  src/dates.js         抽出 isosBefore、新增 isoToCn
修改  server.js            health 加 startedAt/uptime/digest/digestFailures;补漏接口
修改  README.md  .env.example
```

---

# 财报数据源扩展 — 港股源 + 种子导入（2026-08-26）

## 问题

`fin_em.js` 的 `pickAShare` 只认 `.SH/.SZ`，预置的 15 家车企里有 **6 家拿不到结构化报表**：

| 车企 | 代码 | 身份 |
| --- | --- | --- |
| 奇瑞汽车 | 09973.HK | **核心客户**（智界） |
| 吉利汽车 | 00175.HK | 竞品 |
| 理想汽车 | 02015.HK / LI | 竞品 |
| 零跑汽车 | 09863.HK | 竞品 |
| 小鹏汽车 | 09868.HK / XPEV | 竞品 |
| 蔚来汽车 | 09866.HK / NIO | 竞品 |

这几家此前只能靠 DeepSeek 检索起草或手工录入 —— 既烧额度，又拿不到存货/应付/总资产这些细项。

## 一、新增港股源 `src/fin_hk.js`

东方财富港股 F10，与 `fin_em.js` 同一套「累计 → 单季」逻辑、同一个 `upsertQuarterly` 出口。
三点与 A 股源不同，都在文件头注释里写了：

1. **港股接口是长表**（一行一个会计科目 `ITEM_NAME`/`AMOUNT`），不是宽表，得按科目名折叠。
   科目名映射表在 `INCOME_MAP` / `BALANCE_MAP`，没认出来的科目会出现在 probe 响应的 `unmapped` 里，
   补一条正则就多一个字段。
2. **港股不强制季报**。只有中报+年报的公司差分不出单季，**默认跳过而不是硬塞**；
   要按半年口径入库得显式传 `halfYear`，入库时会在 `note` 里标明「本条覆盖两个季度，
   比率类指标可用，绝对值不要与单季公司横比」。
   （实测吉利、奇瑞都有 `2026-03-31` 这一期，能差分出真单季。）
3. **现金流量表的 reportName 没找到** —— 试过 `RPT_HKF10_FN_CASHFLOW` /
   `_CASHFLOWSHEET` / `_CASHFLOWSTATEMENT` 都返回「报表配置不存在」。
   所以港股来源的 `ocf` / `financingCF` 目前为空。哪天找到了，设环境变量
   `HK_CASHFLOW_REPORT=<reportName>` 就自动接上，不用改代码。

另外：**同时有 A 股代码的车企，港股按钮不出现**。原因是两个上市主体不一定是同一个合并范围
（北汽：600733 北汽蓝谷 vs 1958 北京汽车），混着抓会把两家的数字写进同一条记录。
API 直接调时会在 `warn` 里提示。

接口（与 A 股源对称）：

- `GET  /api/fin/hk-probe?company=吉利汽车[&halfYear=1]` — 试抓预览，不保存（已加进 `guard.js` 的 `GUARDED_GET`，要令牌）
- `POST /api/fin/hk-seed-company` `{company, halfYear?}` — 抓取入库，异步，`manual:false`
- `POST /api/refresh` `{what:"fin-hk"}` — 全量，只跑没有 A 股代码的那几家

前端在车企基础行加了「↻ 港股抓取」按钮，只对有 `.HK` 且无 A 股代码的车企显示。

## 二、新增种子导入 `src/fin_import.js` + `seed/fin_import.json`

83 条季度记录、13 家车企（2024Q3–2026Q2），来自另一条链路：交易所与监管接口直采
（东方财富 A股/港股 F10、SEC EDGAR XBRL、巨潮、港交所披露易）+ 财经媒体交叉核对。
每条都带 `sources`。

补的是三大报表里没有、或此前拿不到的东西：

- **季度销量 `sales`** —— 单车指标的分母，报表里没有
- **港股公司的历史季度** —— fin_em 覆盖不到
- **四个新增可选字段**：`netProfitEx` 扣非归母 / `govGrant` 政府补助 /
  `jvIncome` 合联营投资收益 / `overseasPct` 海外收入占比。
  前三个合起来回答一个问题：这家的利润是主业赚的，还是补助和投资收益撑起来的。

按 CLAUDE.md 第 4 条，这四个只加进 `fin_db.cleanQ` 的键列表，不改任何已有字段的含义；
老记录读出来是 `undefined` → `NUM()` 转成 `null`，既有逻辑不受影响，不需要迁移。

三条纪律写死在代码里：

1. 一律 `manual:false` 入库 —— `upsertQuarterly` 自动跳过你手改过的记录，导入不会覆盖人工核对过的数字；
2. **默认 dry-run**，必须显式 `apply:true` 才写库；
3. 生成种子时差分不出单季的期间**直接跳过不猜**（25 条），跳过原因写在 `seed/fin_import.json` 的 `skipped` 里。

接口：

- `GET  /api/fin/import-preview[?company=]` — 预演：要插多少、覆盖多少、几条因手改而保留
- `POST /api/fin/import` `{apply:true, company?, overwriteManual?}` — 落库

**「东风」故意没有导入**：auto-insight 里的东风是 600006.SH 东风汽车股份，
另一边的数据是 00489.HK 东风集团股份（已于 2026-03-18 私有化退市），两个不同主体。
这条写在种子文件的 `notMapped` 里。

## 三、实测

在容器里起服务跑通（假 DB_PATH，未连外网）：

| 用例 | 结果 |
| --- | --- |
| `import-preview` | 83 条待插、0 覆盖、0 未知车企 |
| `import {apply:true}` | 写入 83 条；奇瑞 2026Q1 营收 658.70 亿 / 归母 41.70 亿 —— 与独立抓的港股 F10 逐位一致 |
| 手改一条后重新导入 | `saved 82, skippedManual 1`，手改值 999 被保住，`manual` 仍为 true |
| 写接口无令牌 | 401 |
| `hk-probe` 无令牌 | 401（`GUARDED_GET` 生效） |
| `hk-probe` 传非港股车企 | 500 +「没有港股代码(.HK),港股源不适用:长安汽车」 |
| 出站被拦时 | 干净报错、不挂起、进程存活（容器出网白名单挡住了东方财富） |
| 原有接口 | `/api/health`、`/api/fin`、`/api/models` 全部 200，行为未变 |

## 新增/修改文件

| 文件 | 动作 |
| --- | --- |
| `src/fin_hk.js` | 新增 |
| `src/fin_import.js` | 新增 |
| `seed/fin_import.json` | 新增（83 条季度记录 + 口径说明 + 跳过清单） |
| `server.js` | 加 4 条路由 + `fin-hk` 全量任务，其余未动 |
| `src/fin_db.js` | `cleanQ` 加 4 个可选字段键 |
| `src/guard.js` | `GUARDED_GET` 加 `/fin/hk-probe` |
| `public/fin-board.js` | 加「↻ 港股抓取」按钮 + `seedCompanyHK()` |
| `CLAUDE.md` | 模块清单补 3 行 |

## 遗留

- **港股现金流量表拿不到**（reportName 未知），`ocf`/`financingCF` 对这 6 家为空。
  前端「现金流与还款风险」主题对这几家会缺一项，评分要留意。
- 种子里 `govGrant` / `jvIncome` / `overseasPct` 覆盖稀疏 —— A 股来源的「其他收益」科目
  只是政府补助的近似，精确值要翻财报附注。
- 前端还没有展示新增四个字段的位置，目前只入库不显示。

---

## 追加（同日）：修一个会让数据倒退的合并问题 + 覆盖率体检

### 问题：稀疏数据 upsert 会把已有数字清成空

`upsertQuarterly` 内部是 `{ ...旧记录, ...cleanQ(新记录) }`，而 `cleanQ` 会把**没给的字段一律写成 null**。
也就是说，拿一份稀疏的数据去 upsert，会把之前东方财富抓来的存货／应付／总资产**清空**。

种子恰恰在资产负债表类字段上很稀疏（存货 19%、应付 16%、总资产 21%、现金流 39%），
先抓报表再导种子，等于把刚抓来的东西又抹掉一半 —— 这多半就是"财务数据很多缺失"的来源。

### 修法

1. **`fin_import.js` 改成合并写入**：先把库里已有记录读出来，逐字段做「旧值优先、旧值为空才用种子值」，
   再整条 upsert。出处（sources）也合并去重，不冲掉原来的。
   要反过来以种子为准，显式传 `overwriteExisting:true`。
   实测：先写一条字段齐全的记录，再导入稀疏种子 —— 存货/应付/总资产原值保住，扣非等空位被补上。
2. **`fin_em.js` / `fin_hk.js` 保留新增字段**：三大报表里没有 `netProfitEx`/`govGrant`/`jvIncome`/`overseasPct`，
   抓取时若不显式沿用库里已有值，同样会被 `cleanQ` 清空。已按 `fin_em.js` 原有的 `ex` 机制补上。
   `fin_hk.js` 的 `ocf`/`financingCF` 也一样（港股现金流量表拿不到，绝不能因此清掉手工录的值）。

### 新增：覆盖率体检 `GET /api/fin/coverage[?since=2025]`

排查"哪里缺、怎么补"的入口。每家车企列出 15 个核心字段的「有值期数/总期数」，
外加一条 `advice` 直接说该点哪个按钮。当前库（只导种子、没跑抓取）的实测结果：

```
2025 年起总体填充率 39.7%
完全没有数据：东风、吉利汽车
赛力斯  A股  6期  营收6/6 净利6/6 存货4/6 应付4/6 现金流6/6 销量0/6 扣非6/6
蔚来    港股 6期  营收5/6 净利5/6 存货0/6 应付0/6 现金流0/6 销量6/6 扣非0/6
```

一眼能看出：存货/应付这类要靠报表源补，销量只能靠种子或手工。

### 新增：`fin-em` 与 `fin-all` 两个全量任务

`seedAllEM` 此前只 import 了没接路由，等于一直没法一键跑 A 股全量 —— 补上了。
另加一个 `fin-all`，按正确顺序跑完整条链路：

```
A股全量(seedAllEM) → 港股全量(seedAllHK) → 种子导入(只填空)
```

顺序有讲究：先让两个报表源把三大报表灌满，最后用种子补上报表里根本没有的东西
（季度销量、扣非、政府补助、合联营投资收益、海外收入占比）。

```bash
curl -X POST 你的域名/api/refresh \
  -H "content-type: application/json" -H "x-admin-token: 你的TOKEN" \
  -d '{"what":"fin-all"}'
```

---

# 财报解读（2026-08-26）

## 想要的东西

「自动抓取数据 → 结构化生成这家车企的财报解读」。前面几轮一直在补数据源，
但补完数据只是把表填满，还是要人自己看表得结论 —— 这一轮把最后一段接上。

## 流水线

```
① 抓数据    A股走 fin_em、港股走 fin_hk，抓完落库（manual:false，不覆盖手改）
② 算事实    纯 JS：派生指标 + 环比同比 + 11 条风险信号。这一层完全不碰大模型
③ 写解读    DeepSeek 只负责把算好的事实串成人话，不许自己产生数字
④ 数字校验  解读正文里每个数字都必须能在事实里找到，找不到判幻觉、带着错处重试
⑤ 落库      存进 financials.json 的 reviews（新增顶层键，加进 blank() 自动兼容老文件）
```

**为什么要分这么清楚**：数据是靠算的，叙述才是靠模型的。让模型自己「看财报写解读」，
它会把数字算错、把季度记混、把口径搞反 —— 而这些错误在一段通顺的中文里几乎看不出来。

数字校验实测有效：用假 DeepSeek 第一次故意返回「毛利率 33.7%、营收 999.9 亿」
（事实里根本没有这两个数），被拦下并触发重试，第二次干净通过，`attempts: 2`、`mode: "llm"`。
模型不可用或两次都不过，退回**纯规则版**解读 —— 一个字也不是模型写的，`mode: "rule_only"`。

## 11 条风险信号（供应商视角）

这个站是零部件供应商视角的客户洞察，所以信号不问"这家公司好不好"，
问的是"这家客户还付不付得起款、会不会压我们价、会不会把我们的件自研掉"。

| 编号 | 主题 | 触发条件 |
| --- | --- | --- |
| R1 | 还款风险 | 应付周转天数环比 +15 天以上 |
| R2 | 还款风险 | 经营性现金流为负 |
| R3 | 还款风险 | 货币资金 ÷ 应付款项 < 0.5 |
| R4 | 还款风险 | 经营现金流 ÷ 归母净利 < 0.5 |
| R5 | 盈利与降本压力 | 毛利率环比 -2pct 以上 |
| R6 | 盈利与降本压力 | 归母净利转亏 |
| R7 | 盈利与降本压力 | 归母为正但扣非为负 |
| R8 | 库存压力 | 存货周转天数环比 +10 天以上 |
| R9 | 库存压力 | 销量环比跌超 15% |
| R10 | 自研替代威胁 | `parts` 表里有自研件进入流片/上车/量产 |
| R11 | 自研替代威胁 | 研发费率环比 +1pct 且单车研发上升 |

R10 直接吃你 `parts` 表的数据，把主题 3「自研智驾部件追踪」接进了解读。
每条信号都带 `evidence`（具体数值）、`meaning`（对我们意味着什么）、`counter`（什么情况下这条不成立）。

## 接口

| 接口 | 说明 |
| --- | --- |
| `POST /api/fin/review` `{company, year?, q?, refetch?}` | 抓数 + 生成，异步，走 `tooSoon` + `overBudget` |
| `GET /api/fin/review?company=` | 读该车企的全部解读 |
| `GET /api/fin/review?company=&year=&q=` | 读某一期 |
| `DELETE /api/fin/review/:id` | 删 |
| `POST /api/refresh` `{what:"fin-review"}` | 全量（15 家各生成一份最新期） |
| `POST /api/refresh` `{what:"fin-review-core"}` | 只跑 8 家核心客户 |

前端在车企视图最上方加了「财报解读」卡片：等级徽章（健康/承压/预警）、一句话结论、
分主题要点（带信号编号）、**「对我们的含义」红框**、下季盯什么、反证条件、数据缺口清单。
没有解读时显示「⚡ 生成财报解读」按钮。

## 实测

赛力斯 2026Q2（纯规则版，未调 LLM）：

```
预警 · 触发 2 条高风险信号
盈利与降本压力 R5 R6
  · 毛利率从 26.2% 掉到 20.9% —— 毛利被压缩，接下来大概率把降本压力传导到零部件采购价
  · 本季归母净利 -24.71 亿元，亏损 —— 亏损期的车企对采购价格最敏感，也最容易延长账期
数据缺口 13 项
```

同一期走 LLM 路径（假 DeepSeek），数字校验通过后的输出：

```
赛力斯2026Q2归母净利-24.71亿元，毛利率降至20.9%，转入亏损。
对我们的含义
  · 亏损季的客户对采购价最敏感，报价与账期都会被压
  · 应付账款数据缺失，回款风险无法评估，建议补数据后再定信用额度
```

## 新增/修改文件

| 文件 | 动作 |
| --- | --- |
| `src/fin_review.js` | 新增 |
| `src/fin_db.js` | 新增顶层键 `reviews` + upsert/get/list/delete |
| `server.js` | 加 3 条 review 路由 + 2 个全量任务 |
| `public/fin-board.js` | 车企视图加「财报解读」卡片 + `genReview()` |

## 遗留

- 解读质量直接取决于数据完整度。赛力斯那条的「数据缺口 13 项」不是 bug，
  是库里确实没有存货/应付/货币资金 —— 先跑 `{"what":"fin-all"}` 把数据补满，解读才有厚度。
- 港股 6 家的现金流量表仍拿不到，R2/R4 两条信号对它们永远不触发，不是"没风险"是"看不见"。
- `sales` 缺失时 R9（销量环比）和单车指标都出不来。
