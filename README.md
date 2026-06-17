# 车企洞察终端 · Auto Insight

中国车企财报、行业速递、车型上市三大板块。**服务端**通过 Anthropic API 联网检索公开信息并返回带来源链接的结构化结果;支持每日 09:00 自动生成日报并邮件推送给订阅者。

> 为什么是后端:浏览器直连 `api.anthropic.com` 会因鉴权/跨域被挡(纯前端 `Failed to fetch`)。把检索放到服务端后,用你自己的 API key 调用,稳定且密钥不外泄。

## 功能

| 板块 | 接口 | 说明 |
|---|---|---|
| 车企财务数据 | `GET /api/financials` | 主要上市车企最新季报/年报要点,点开看 AI 财报全文分析 |
| 行业信息速递 | `GET /api/news` | 当日行业日报(优先返回已落库快照,与邮件内容一致) |
| 车型上市速递 | `GET /api/launches` | 新车/改款上市,含小定/大定/销量 |
| 详情 | `POST /api/detail` | `{kind:"fin|news|launch", item:{...}}` |
| 订阅 | `POST /api/subscribe` | `{email}`,写入数据库 |

每条数据均带 `sources` 来源链接,供核查。

## 本地运行

```bash
npm install
cp .env.example .env        # 填入 ANTHROPIC_API_KEY
npm start                   # http://localhost:3000
```

手动触发(不必等定时):
```bash
npm run digest:gen          # 立即生成当日日报并落库
npm run digest:send         # 立即给订阅者发当日日报
```

## 部署到 Railway

1. 推到 GitHub,在 Railway `New Project → Deploy from GitHub repo`。
2. Variables 里设置环境变量(见下表)。`PORT` 由 Railway 自动注入,无需手填。
3. **数据持久化(重要)**:Railway 容器文件系统重启即清空。给服务挂一个 Volume,挂载路径例如 `/data`,并设 `DB_PATH=/data/data.json`,订阅表才不会丢。或改用 Railway Postgres(见文末)。
4. 启动命令默认 `npm start`,已含定时任务。

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic 控制台获取 |
| `CLAUDE_MODEL` | | `claude-sonnet-4-6` | 模型 |
| `DB_PATH` | | `./data.json` | SQLite 路径(Railway 设为 Volume 内路径) |
| `CRON_TZ` | | `Asia/Shanghai` | 定时任务时区,决定"9点"是哪个9点 |
| `RESEND_API_KEY` | | 空 | 邮件密钥;留空则不发信只记日志 |
| `MAIL_FROM` | | `onboarding@resend.dev` | 发件人;正式使用需在 Resend 验证自有域名 |

## 邮件(Resend)

1. resend.com 注册,拿 API Key,填到 `RESEND_API_KEY`。
2. 测试期可用 `onboarding@resend.dev` 发件;正式发给任意邮箱需验证自有发件域名,再把 `MAIL_FROM` 改成该域名邮箱。
3. 想换 SendGrid:只需改写 `src/mailer.js` 里 `sendOne()` 一个函数。

## 定时任务

`src/cron.js`:每月 1 号 08:00 刷新财报;每天 08:30 刷新当日日报与上市动态;每天 09:00 给订阅者群发日报。时区由 `CRON_TZ` 控制。时区由 `CRON_TZ` 控制。

## 换 Postgres(可选)

SQLite + Volume 足够个人/小团队使用。若要更稳的持久化:Railway 加 Postgres 插件,把 `src/db.js` 改成 `pg` 实现(表结构不变:`subscribers` / `digests`),其余代码无需改动。

## 目录

```
server.js            Express:静态前端 + API + 内存缓存 + 启动 cron
src/claude.js        Anthropic 调用(web_search)+ JSON 解析
src/prompts.js       三板块 + 详情提示词
src/db.js            SQLite:订阅 / 日报快照
src/mailer.js        Resend 发信
src/digest.js        日报邮件 HTML
src/cron.js          定时:生成 / 推送
public/index.html    前端(仪表盘 UI)
```

数据来自公开来源的实时检索,存在时效与覆盖差异,关键数据请以来源原文为准。
