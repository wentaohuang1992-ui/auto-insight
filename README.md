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
- 每天 08:30 日报 / 09:00 邮件推送

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
- `jobBudgetLeft` 是本小时还能触发的抓取次数。

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
src/cron.js          定时任务编排
src/*_db.js          各板块数据库
src/*_seed.js        各板块抓取入库
public/              前端(单页 + 4 个板块脚本)
```
