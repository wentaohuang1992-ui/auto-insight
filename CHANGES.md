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
