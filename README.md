# 车企洞察终端(auto-insight)

中国车企情报网站:车企财报 / 行业日报 / 新车上市速递。每条信息带来源链接可核查。

## 模型与搜索
- **语言模型**:DeepSeek(OpenAI 兼容,默认 `deepseek-v4-flash`)。
- **联网搜索**:博查 Bocha Web Search(中文覆盖好,DeepSeek 官方搜索供应方)。
- 工作方式:博查搜索拿到中文网页与真实链接 → 交给 DeepSeek 整理成结构化内容,来源链接取自博查结果。

## 环境变量
见 `.env.example`。必填:`DEEPSEEK_API_KEY`、`BOCHA_API_KEY`。
持久化:`DB_PATH=/data/data.json`(Railway 挂载 /data 卷)。

## 定时任务(Asia/Shanghai)
- 每月 1 号 08:00 财报 / 08:10 上市节奏
- 每天 08:30 日报 / 09:00 邮件推送

## 本地运行
```
npm install
cp .env.example .env   # 填入两个 key
npm start
```

## 部署(Railway)
GitHub 仓库 → Railway 自动部署;配置上述环境变量;挂载 /data 卷;Hobby 计划常驻(勿开 Serverless,否则定时任务不触发)。
