# CLAUDE.md — auto-insight(车企洞察终端)

给以后每次会话看的项目上下文。**开工前先读这一份**,再读 `CHANGES.md`(历次工程加固的原委,
别推翻里面的决定)。

---

## 这是什么

一个中国车企情报站:每日行业日报 + 车企财报 + 新车上市节奏 + 存储/智驾/云算力专题。
数据不是人工录的,是**每天定时用检索 + 大模型现生成的**,每条信息带来源链接。

- 运行形态:单进程 Node(Express),前端是 `public/` 下的静态单页,没有构建步骤。
- 部署:Railway,Hobby 计划常驻(**不能开 Serverless,否则定时任务不触发**)。
- 外部依赖:**DeepSeek**(生成,OpenAI 兼容接口)、**博查 Bocha**(中文网页检索)、
  Google News RSS(实时新闻)、东方财富(A 股财务数据)、Resend(发邮件)。
- 这四个外部服务里,DeepSeek 和博查是**按量付费**的 —— 成本约束贯穿整个代码库,
  见下面「花钱的路径」。

---

## 必须遵守的约定

违反这几条会直接把线上数据搞坏或者把钱烧掉,写代码前先对一遍:

1. **所有文件写入必须走 `src/store.js`**,不要 `fs.writeFileSync`。
   store.js 提供 `tmp → fsync → rename` 的原子写入 + `.bak` 备份 + 损坏文件锁定。
   曾经因为直接 writeFileSync,进程写到一半被杀 → 文件截断 → load() 静默返回空对象 →
   下一次 save() 把空数据写回去,手工维护的车型库和财务库**无声无息全没了**。

2. **所有出站请求必须走 `src/http.js` 的 `fetchWithTimeout`**,不要裸 `fetch`。
   node 的 fetch 默认没有超时,上游一挂,定时任务就永久卡住,任务状态永远停在 running。
   一般请求用 `HTTP_TIMEOUT_MS`(20s),大模型用 `LLM_TIMEOUT_MS`(120s)。

3. **会花钱的新接口必须过 `src/guard.js`**:写操作要 `x-admin-token`;
   会打外部付费接口的路径要么要令牌,要么按 IP 限流;抓取类任务要调 `overBudget()`
   扣全局预算(`JOB_MAX_PER_HOUR`,默认 20 次/小时)。**不要绕过它自己实现限流。**

4. **不要改动已有数据文件的结构**。`data.json` 等文件在线上有真实数据,只能加可选字段,
   不能改已有字段的含义或形状。新增顶层键要加进对应 db 模块的 `blank()`,
   靠 `{ ...blank(), ...readStore(...) }` 这个展开顺序自动兼容老文件(不需要写迁移)。

5. **并发用 `src/pool.js`**,不要再手写一份限流器(以前有三份重复实现,已合并)。

6. 本地跑必须设 `DB_PATH`,否则数据文件会散落在工作目录;Railway 上是 `/data/data.json`。

---

## 目录与模块职责

```
server.js              Express 路由 + 静态托管 + /api/health。只做参数校验和编排,
                       业务逻辑不写在这里。
src/
  store.js             【基础设施】JSON 存储层:原子写入 / .bak 备份 / 损坏锁定 /
                       storageInfo()。所有 *_db.js 都建在它上面。
  guard.js             【基础设施】令牌校验 / IP 限流 / 任务最短间隔 tooSoon() /
                       全局抓取预算 overBudget() / 用户输入清洗 cleanName()。
  http.js              【基础设施】fetchWithTimeout。所有出站请求的唯一入口。
  pool.js              【基础设施】并发限流执行,结果保序。
  dates.js             【基础设施】时区安全的日期计算(today / isosBefore /
                       recentIsos / isoToCn)。日期一律用 Asia/Shanghai 的 iso 串。

  llm.js               DeepSeek 客户端 + 健壮 JSON 解析(3 级兜底:强制 JSON 模式 →
                       普通模式 → 加硬约束;再不行按括号配平抢救截断的输出)。
  search.js            博查检索
  news_rss.js          Google News RSS
  research.js          检索 → 拼资料 → 按 schema 出 JSON 的通用管道

  claude.js            日报 / 财报 / 详情的任务层(文件名是历史遗留,跟 Anthropic 无关)
  cadence.js           上市节奏(按品牌逐个检索)
  storage.js market.js 存储洞察 / 品牌市场小结
  models_incremental.js 从当天日报里抽车型变化,字段级并进车型库

  cron.js              【编排】定时任务 + 日报生成的重试/补漏/失败留痕。见下节。
  db.js                主库 data.json:订阅者 / 板块快照 / 日报归档 / 日报失败记录
  models_db.js fin_db.js ds_db.js cloud_db.js storage_db.js   各板块数据库
  *_seed.js            各板块的抓取入库任务
  fin_em.js            东方财富 F10 抓取(**A 股**,宽表)→ 累计换单季 → 季度表
  fin_hk.js            东方财富 F10 抓取(**港股**,长表按科目名折叠)→ 同上。
                       补 fin_em 覆盖不到的 6 家:奇瑞/吉利/理想/零跑/小鹏/蔚来
  fin_import.js        一次性种子导入(交易所直采 + 媒体交叉核对),读 seed/fin_import.json
                       + coverage():覆盖率体检,排查"哪里缺、该点哪个按钮"
  fin_flash.js         【财报速递】横表:每家一行 × 每个报告期「发布时间 + 一句话总结」。
                       覆盖整车 12 + 零部件供应商 5;不依赖 quarterly 表,自己按代码取数。
                       数据文件 flash.json。
  fin_review.js        【财报解读】一键:自动抓数 → 纯 JS 算指标与 11 条风险信号 →
                       DeepSeek 只做叙述 → 数字校验(正文里的数字必须在事实里找得到)→ 落库。
                       数据靠算,叙述才靠模型 —— 别让模型自己看财报写数字。
  digest.js mailer.js  日报邮件渲染 / 发送(Resend)

public/                前端单页 + 4 个板块脚本 + api-auth.js(自动带令牌头)
```

数据文件(默认都在 `DB_PATH` 所在目录):
`data.json`(主库)、`models.json`、`financials.json`、`flash.json`、`downshift.json`、`cloud.json`、`storage.json`。

仓库内还有 `seed/fin_import.json` —— 一次性导入用的种子,不是运行时数据文件,不会被写。

---

## 数据流

**每天的日报**(最主要的链路):

```
cron 08:30
  └→ dailyJob()                                    src/cron.js
       ├→ generateDaily() ─→ generateDigestFor()   带重试
       │     └→ getSection("news")                 src/claude.js
       │          ├→ 7 个博查查询(4 并发)          src/search.js  → http.js
       │          ├→ 5 个 Google News 查询(并行)   src/news_rss.js → http.js
       │          ├→ 拼提示词 + 跨天去重(排掉最近 3 天报过的)
       │          └→ chatJSON()                    src/llm.js     → http.js
       │     └→ saveDigest(iso, news)              src/db.js      → store.js
       │     └→ updateFromNews()                   增量更新车型库
       └→ backfillDigests()                        补最近 14 天的缺口
cron 09:00
  └→ sendDaily() → 取当天日报 → digest.js 渲染 → mailer.js 发给订阅者
```

**板块数据**:`GET /api/xxx` → 有快照就直接返回,没有就懒生成一次并存快照;
定时任务按各自节奏刷新(财报/车型库/上市节奏每月 1 号,存储洞察每周一)。

**定时任务表**(时区 `CRON_TZ`,默认 Asia/Shanghai):

| 时间 | 任务 |
| --- | --- |
| 每天 08:30 | 日报生成(带重试)+ 补漏 |
| 每天 09:00 | 日报邮件推送 |
| 每周一 08:20 | 存储洞察 |
| 每月 1 号 08:00 / 08:10 / 08:40 | 财报 / 车型库 / 上市节奏 |
| 启动后 15 秒 | 补漏检查一次 |

---

## 日报可靠性(2026-08 加的,重点)

**为什么做**:`/api/news/archive` 显示 66 天里缺了 10 天,失败率 15%,而且是连续断档
(08-01~08-05 连着 5 天、07-19~07-21 连着 3 天)。连续多天不是网络抖动,更像配额耗尽 /
密钥失效 / 上游长时间故障。原来的 `generateDaily` 失败就是失败了,不重试、不补、不告警。

四层防护,改的时候别拆掉其中一层:

1. **重试**(`generateDigestFor`):指数退避 20s → 40s,默认重试 2 次。
   挡的是一次性抖动。
2. **补漏**(`backfillDigests`):启动时 + 每天日报任务后,检查最近 14 天的缺口并补。
   挡的是持续数小时到数天的故障 —— 故障恢复后自动把坑填上。
   **光有重试不够**(连缺 5 天时,当天重试多少次都没用);**光有补漏也不够**(抖动本可以
   当场救回来)。
3. **失败留痕**:最终仍失败就把日期 + 错误原文 + 尝试次数写进 `data.json` 的
   `digestFailures`,`/api/health` 直接能看,不用去翻 Railway 日志。
4. **超时闸**:`http.js` 限的是单个请求,但一次日报要打十几个请求、`chatJSON` 内部还有
   3 级兜底(每级各一个 120s),单次尝试最坏能到 6 分钟以上。所以另有两道闸:
   `DIGEST_ATTEMPT_TIMEOUT_MS`(单次尝试,默认 4 分钟)和 `DIGEST_RETRY_DEADLINE_MS`
   (整轮含退避,默认 10 分钟)。**默认参数下最坏总耗时正好 10 分钟,是硬顶。**

改这块时注意几个坑:

- 单次尝试超时后,底层 fetch 是**取消不掉的**(只有 http.js 里的 AbortController 能取消)。
  所以用 `token.cancelled` 标记,迟到的结果不许再写库 —— 否则会覆盖掉后来重试成功的那份。
- 别在算「单次尝试上限」时给剩余预算兜一个下限(比如 `Math.max(30_000, leftMs)`),
  那等于允许最后一次尝试冲破 deadline。这个 bug 犯过一次。
- 生成和补漏共用一把串行锁 `serial()`:两者都烧额度、都写 `data.json`,不能并发。

### 补漏的成本约束(最容易出事的地方)

每补一天 = 一轮博查(7 次查询)+ 一次 DeepSeek 生成。所以有三重上限,**都不要绕过**:

- 单轮最多补 `DIGEST_BACKFILL_MAX` 天(默认 3),从最近的往前补,剩下的留给下一轮;
- 每补一天前先调 `guard.js` 的 `overBudget()` 扣全局预算,没额度就停;
- `DIGEST_BACKFILL=0` 整个关掉;
- 补漏的重试次数单独收敛到 1 次(`DIGEST_BACKFILL_RETRY`)—— 历史日报不值得反复烧钱。

**补出来的日报和当天生成的不是一回事**,必须区分:检索接口只能搜"现在搜得到的",
补 3 周前的日报拿不回那天的实时流。代码里的处理是:博查窗口放宽到一个月、跳过 Google News
(它只有最近两天,拉回来只会把今天的新闻混进历史日报)、提示词里锁死目标日期。
结果标记在两个地方:归档记录的 `source: "backfill"`,和日报内容里的 `backfilled: true`。
**不要把这个标记去掉**,也不要拿补出来的日报去做车型库增量更新(内容时间混杂,会污染
手工维护的数据)。

---

## /api/health 怎么看

部署后自检和排障都靠它:

| 字段 | 看什么 |
| --- | --- |
| `ok` | `false` 说明有数据文件损坏并已锁定写入,要人工处理 |
| `storage.persistent` | **必须是 `true`**;`false` = `DB_PATH` 没设,数据在临时盘,下次部署就没了 |
| `storage.files` | 各数据文件的大小和最后写入时间,用来确认重新部署后数据还是原来那份 |
| `lockedStores` | 非空 = 某个文件损坏已停写 |
| `startedAt` / `uptime` | 进程什么时候起来的。**改完环境变量对一下这个时间**,早于改动时间就说明压根没重启,而不是配置写错了 |
| `digest.missingRecent` | 最近 14 天还缺哪几天日报 |
| `digest.lastBackfill` | 上一轮补漏补了什么、为什么停 |
| `digestFailures` | 最近 N 次生成失败(日期 + 错误原文 + 尝试次数),`?failures=50` 可多看几条 |
| `jobBudgetLeft` | 本小时还能触发几次抓取任务 |
| `adminToken` | 「未配置」= 写接口对全网开放 |

---

## 本地开发

```bash
npm install
cp .env.example .env    # 至少填 DEEPSEEK_API_KEY、BOCHA_API_KEY,并设 DB_PATH
npm start
```

`DB_PATH` 必须设(比如 `DB_PATH=./data/data.json`),否则数据文件会散在工作目录里。

手动跑单个任务:

```bash
npm run digest:gen     # 生成今天的日报
npm run digest:send    # 发邮件
```

**项目没有测试框架,也没有 lint。** 改完动不了真实接口的部分(日期计算、重试退避、
补漏选取、失败留痕),可以把纯逻辑抽出来单跑验证 —— 这些函数都刻意写成了不依赖 IO 的形状。

---

## 改动时的注意事项

- 前端是散在 5 个文件里的几十处 `fetch`,不要挨个改 —— `public/api-auth.js` 已经包装了
  `window.fetch` 自动带令牌头。
- 新增环境变量要同时写进 `.env.example`,并在这里和 README 说明。
- `src/claude.js` 这个文件名跟 Anthropic 没关系,是历史遗留,别照着名字理解。
- 提示词里凡是要拼用户输入的地方,先过 `guard.js` 的 `cleanName()`(限长 + 去换行),
  否则既能撑 token 也能往提示词里塞指令。
- 日报归档按 `DIGEST_KEEP_DAYS`(默认 180 天)自动裁剪,`data.json` 不会无限膨胀。
