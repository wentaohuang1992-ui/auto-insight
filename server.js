import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSection, getDetail } from "./src/claude.js";
import { addSubscriber, getDigest } from "./src/db.js";
import { startCron, generateDaily } from "./src/cron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── 简单内存缓存(财报/上市数据 30 分钟,降低 API 成本) ──
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return Promise.resolve(hit.v);
  return fn().then((v) => { cache.set(key, { t: Date.now(), v }); return v; });
}
const TTL = 30 * 60 * 1000;
const fail = (res) => (e) => res.status(500).json({ error: e.message || "服务端错误" });

// ── 板块数据 ──
app.get("/api/financials", (req, res) => {
  const job = req.query.fresh ? getSection("fin") : cached("fin", TTL, () => getSection("fin"));
  job.then((d) => res.json(d)).catch(fail(res));
});

app.get("/api/launches", (req, res) => {
  const job = req.query.fresh ? getSection("launch") : cached("launch", TTL, () => getSection("launch"));
  job.then((d) => res.json(d)).catch(fail(res));
});

// 行业新闻:优先返回当日已生成的日报快照,保证与邮件内容一致
app.get("/api/news", (req, res) => {
  if (!req.query.fresh) {
    const date = new Intl.DateTimeFormat("zh-CN", {
      timeZone: process.env.CRON_TZ || "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(new Date());
    const g = (t) => date.find((p) => p.type === t)?.value || "";
    const today = `${g("year")}年${g("month")}月${g("day")}日`;
    const snap = getDigest(today);
    if (snap) return res.json(snap);
  }
  generateDaily().then((d) => res.json(d)).catch(fail(res)); // 现生成并落库
});

// ── 详情 ──
app.post("/api/detail", (req, res) => {
  const { kind, item } = req.body || {};
  if (!kind || !item) return res.status(400).json({ error: "缺少 kind 或 item" });
  getDetail(kind, item).then((d) => res.json(d)).catch(fail(res));
});

// ── 订阅 ──
app.post("/api/subscribe", (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "邮箱格式不正确" });
  const isNew = addSubscriber(email);
  res.json({ ok: true, isNew });
});

app.get("/api/health", (req, res) => res.json({ ok: true, model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`车企洞察终端 运行于 http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("⚠ 未设置 ANTHROPIC_API_KEY,板块数据接口会报错");
  startCron();
});
