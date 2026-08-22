# 车企洞察终端(auto-insight)

中国车企情报网站:车企财报 / 行业日报 / 新车上市速递 / 存储、智驾、云算力专题。每条信息带来源链接可核查。

## 模型与搜索
- **语言模型**:DeepSeek(OpenAI 兼容,默认 `deepseek-v4-flash`)。
- **联网搜索**:博查 Bocha Web Search(中文覆盖好,DeepSeek 官方搜索供应方)。
- 工作方式:博查搜索拿到中文网页与真实链接 → 交给 DeepSeek 整理成结构化内容,来源链接取自博查结果。

## 环境变量
见 `.env.example`。必填:`DEEPSEEK_API_KEY`、`BOCHA_API_KEY`。
强烈建议填 `ADMIN_TOKEN`(见下)。持久化:`DB_PATH=/data/data.json`(Railway 挂载 /data 卷)。

## 访问控制
- `GET` 接口一律公开(这是个对外的资讯站)。
- 写接口(`POST/PUT/DELETE`)与会打外部付费接口的 GET(`/api/fin/em-probe`)需要请求头 `x-admin-token`,值等于服务端 `ADMIN_TOKEN`。
  在网页右上角点「🔑」填入即可,令牌存在浏览器本地。
- `/api/detail`、`/api/subscribe` 是终端用户功能,保持公开,但按 IP 限流。
- **未设置 `ADMIN_TOKEN` 时写接口对全网开放**,启动日志会告警。上线前务必设置。
- 抓取类任务另有最短触发间隔(`JOB_MIN_GAP_MS`,默认 60 秒),防止连点烧额度。

## 数据文件与损坏保护
`data.json`(订阅/快照/日报归档)、`models.json`、`financials.json`、`downshift.json`、`cloud.json`、`storage.json`,默认都放在 `DB_PATH` 所在目录。

所有写入走 `src/store.js`:临时文件 → `fsync` → `rename`(原子),并把上一版留成 `<file>.bak`。
读取时如果主文件解析失败:

1. 自动回退到 `.bak`(**会丢失最近一次写入**,日志会告警);
2. 若 `.bak` 也坏,把主文件另存为 `<file>.corrupt-<时间戳>`,并**锁定该文件的写入**——读取返回空结构让服务继续跑,但任何写入都会报错,避免空数据覆盖掉还有救的内容。此时 `/api/health` 的 `ok` 为 `false`、`lockedStores` 会列出问题文件。
   确认放弃旧数据时,设 `STORE_FORCE_RESET=1` 启动一次即可从空数据重建。

日报归档按 `DIGEST_KEEP_DAYS`(默认 180 天)自动裁剪。

## 定时任务(Asia/Shanghai)
- 每月 1 号 08:00 财报 / 08:10 车型库 / 08:40 上市节奏
- 每周一 08:20 存储洞察
- 每天 08:30 日报(失败自动重试)+ 补漏检查 / 09:00 邮件推送
- 启动后 15 秒:补漏检查一次

## 日报可靠性
日报是每天现生成的,上游(博查 / DeepSeek)一出问题那天就会缺。四层防护:

1. **重试**:生成失败按指数退避重试(默认 20s → 40s,共 2 次)。挡一次性抖动。
2. **补漏**:启动时和每天日报任务结束后,检查最近 `DIGEST_BACKFILL_DAYS`(默认 14)天
   有没有缺的日期,缺了就从最近的往前补。挡持续几小时到几天的故障。
   成本上限:单轮最多补 `DIGEST_BACKFILL_MAX`(默认 3)天,每补一天都要过全局抓取预算,
   `DIGEST_BACKFILL=0` 可整个关掉。
3. **失败留痕**:最终仍失败的日期 + 错误原文 + 尝试次数写进 `data.json`,
   在 `/api/health` 的 `digestFailures` 里直接能看,不用翻平台日志。
4. **超时硬顶**:`HTTP_TIMEOUT_MS` / `LLM_TIMEOUT_MS` 限的是单个请求,而一次日报要打
   十几个请求,所以另有 `DIGEST_ATTEMPT_TIMEOUT_MS`(单次尝试,默认 4 分钟)和
   `DIGEST_RETRY_DEADLINE_MS`(整轮含退避,默认 10 分钟)。默认参数下最坏就是 10 分钟。

**补出来的日报会被标记**(归档记录 `source: "backfill"`、内容里 `backfilled: true`):
检索只能搜"现在搜得到的",补历史日期拿不回那天的实时新闻流,质量不如当天生成。

需要一次性补更久以前的缺口时,临时把 `DIGEST_BACKFILL_DAYS` 调大再重启即可
(单轮仍只补 3 天,多跑几轮 / 多重启几次,或调用下面的手动接口)。

手动触发补漏(需要 `ADMIN_TOKEN`):

```
curl -X POST -H "x-admin-token: <你的令牌>" https://<域名>/api/news/backfill
```

## 本地运行
```
npm install
cp .env.example .env   # 至少填 DEEPSEEK_API_KEY、BOCHA_API_KEY,建议再加 ADMIN_TOKEN
npm start
```

## 部署后自检

访问 `/api/health`:

- `storage.persistent` 必须是 `true` —— 为 `false` 说明 `DB_PATH` 没设,数据在容器临时盘上,**下次部署会全部丢失**;
- `storage.files` 里应能看到各数据文件的大小与最后写入时间;
- `lockedStores` 应为空数组;
- `adminToken` 建议是「已配置」;
- `jobBudgetLeft` 是本小时还能触发的抓取次数;
- `startedAt` / `uptime` 是进程启动时间与已运行时长 —— **改完环境变量后对一下这个时间**,
  如果 `startedAt` 早于你改配置的时刻,那就是还没重启,而不是配置写错了;
- `digest.missingRecent` 是最近 14 天仍然缺日报的日期,`digest.lastBackfill` 是上一轮补漏
  的结果,`digestFailures` 是最近 N 次生成失败(带错误原文,`?failures=50` 可多看几条)。

## 部署(Railway)
GitHub 仓库 → Railway 自动部署;配置上述环境变量;挂载 /data 卷;Hobby 计划常驻(勿开 Serverless,否则定时任务不触发)。

## 目录
```
server.js            Express 路由 + 静态托管
src/store.js         JSON 存储层:原子写入 / 备份 / 损坏锁定
src/guard.js         管理员令牌校验 + 公开接口限流 + 任务最短间隔
src/http.js          带超时的 fetch(所有出站请求都走它)
src/pool.js          并发限流执行
src/llm.js           DeepSeek 客户端 + 健壮 JSON 解析
src/search.js        博查搜索
src/news_rss.js      Google News RSS 实时源
src/research.js      检索 → 组装资料 → 按 schema 出 JSON
src/claude.js        日报 / 财报 / 详情任务
src/cadence.js       上市节奏(按品牌逐个检索)
src/cron.js          定时任务编排 + 日报重试/补漏/失败留痕
src/dates.js         时区安全的日期计算
src/*_db.js          各板块数据库
src/*_seed.js        各板块抓取入库
public/              前端(单页 + 4 个板块脚本)
```
