import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDetail } from "./src/claude.js";
import { addSubscriber, getSnapshot, getDigest, listDigests } from "./src/db.js";
import { startCron, refreshFinancials, refreshLaunches, generateDaily } from "./src/cron.js";
import { today } from "./src/dates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const fail = (res) => (e) => res.status(500).json({ error: e.message || "服务端错误" });

// 读取快照;若尚未生成(如首次部署),按需生成一次并落库,之后直接走存储
async function snapshotResponse(kind, refresher) {
  let s = getSnapshot(kind);
  if (!s) { await refresher(); s = getSnapshot(kind); }
  return { ...(s?.payload || {}), updated_at: s?.updated_at || null };
}

app.get("/api/financials", (req, res) =>
  snapshotResponse("fin", refreshFinancials).then((d) => res.json(d)).catch(fail(res)));

app.get("/api/launches", (req, res) =>
  snapshotResponse("launch", refreshLaunches).then((d) => res.json(d)).catch(fail(res)));

// 当日日报:有则返回,无则生成一次
app.get("/api/news", (req, res) => {
  (async () => {
    const { iso } = today();
    let d = getDigest(iso);
    if (!d) d = await generateDaily();
    return d;
  })().then((d) => res.json(d)).catch(fail(res));
});

// 往期日报列表 + 指定日期日报
app.get("/api/news/archive", (req, res) => {
  try { res.json({ items: listDigests() }); } catch (e) { fail(res)(e); }
});
app.get("/api/news/:iso", (req, res) => {
  const d = getDigest(req.params.iso);
  if (!d) return res.status(404).json({ error: "未找到该日期的日报" });
  res.json(d);
});

app.post("/api/detail", (req, res) => {
  const { kind, item } = req.body || {};
  if (!kind || !item) return res.status(400).json({ error: "缺少 kind 或 item" });
  getDetail(kind, item).then((d) => res.json(d)).catch(fail(res));
});

app.post("/api/subscribe", (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "邮箱格式不正确" });
  res.json({ ok: true, isNew: addSubscriber(email) });
});

app.get("/api/health", (req, res) => res.json({ ok: true, model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`车企洞察终端 运行于 http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("⚠ 未设置 ANTHROPIC_API_KEY,板块数据接口会报错");
  startCron();
});
