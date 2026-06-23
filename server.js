import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDetail } from "./src/claude.js";
import { generateCadence } from "./src/cadence.js";
import { addSubscriber, getSnapshot, saveSnapshot, getDigest, listDigests } from "./src/db.js";
import { startCron, refreshFinancials, refreshCadence, refreshStorage, generateDaily } from "./src/cron.js";
import { today } from "./src/dates.js";
import { listModels, getModel, putModel, addModel, deleteModel, dbMeta } from "./src/models_db.js";
import { seedModels, seedOneBrand } from "./src/models_seed.js";
import { brandMarket } from "./src/market.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "请求体不是合法 JSON" });
  next(err);
});
app.use(express.static(path.join(__dirname, "public")));

const fail = (res) => (e) => res.status(500).json({ error: e.message || "服务端错误" });

async function snapshotResponse(kind, refresher) {
  let s = getSnapshot(kind);
  if (!s) { await refresher(); s = getSnapshot(kind); }
  return { ...(s?.payload || {}), updated_at: s?.updated_at || null };
}

app.get("/api/financials", (req, res) =>
  snapshotResponse("fin", refreshFinancials).then((d) => res.json(d)).catch(fail(res)));

app.get("/api/storage", (req, res) =>
  snapshotResponse("storage", refreshStorage).then((d) => res.json(d)).catch(fail(res)));

// 上市节奏:三大类快照(缺失则按需生成一次),合并为一个响应
async function cadCat(cat) {
  let s = getSnapshot("cad_" + cat);
  if (!s) { const d = await generateCadence(cat); saveSnapshot("cad_" + cat, d); s = getSnapshot("cad_" + cat); }
  return s;
}
app.get("/api/cadence", (req, res) => {
  Promise.all(["yinwang", "xinshili", "chuantong"].map(cadCat))
    .then(([yw, xs, ct]) => res.json({
      updated_at: yw.updated_at, yinwang: yw.payload, xinshili: xs.payload, chuantong: ct.payload
    }))
    .catch(fail(res));
});

app.get("/api/news", (req, res) => {
  (async () => { const { iso } = today(); let d = getDigest(iso); if (!d) d = await generateDaily(); return d; })()
    .then((d) => res.json(d)).catch(fail(res));
});
app.get("/api/news/archive", (req, res) => { try { res.json({ items: listDigests() }); } catch (e) { fail(res)(e); } });
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

// —— 车型数据库 ——
app.get("/api/models", (req, res) => { try { res.json({ models: listModels(), meta: dbMeta() }); } catch (e) { fail(res)(e); } });
app.post("/api/models", (req, res) => {
  const r = addModel(req.body || {});
  if (!r) return res.status(409).json({ error: "该车型已存在(品牌+车型重复)" });
  res.json({ ok: true, model: r });
});
app.put("/api/models/:id", (req, res) => {
  const r = putModel(req.params.id, req.body || {});
  if (!r) return res.status(404).json({ error: "未找到该车型记录" });
  res.json({ ok: true, model: r });
});
app.delete("/api/models/:id", (req, res) => {
  res.json({ ok: deleteModel(req.params.id) });
});

// 车企市场动态(免费新闻 + 缓存洞察)
app.get("/api/brand-market", (req, res) => {
  const brand = String(req.query?.brand || "").trim();
  if (!brand) return res.status(400).json({ error: "缺少 brand" });
  brandMarket(brand).then((d) => res.json(d)).catch(fail(res));
});

const jobs = {}; // what -> {status:'running'|'done'|'error', startedAt, finishedAt, error}

// 单品牌重新抓取(定向、异步)
app.post("/api/models/seed-brand", (req, res) => {
  const brand = String(req.body?.brand || "").trim();
  if (!brand) return res.status(400).json({ error: "缺少 brand" });
  const key = "brand:" + brand;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  jobs[key] = { status: "running", startedAt: Date.now() };
  seedOneBrand(brand)
    .then(() => { jobs[key] = { status: "done", finishedAt: Date.now() }; })
    .catch((e) => { console.error("[seed-brand]", brand, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "抓取失败" }; });
  res.status(202).json({ status: "started", key });
});

const RUNNERS = { fin: refreshFinancials, cadence: refreshCadence, storage: refreshStorage, news: generateDaily, models: seedModels };
app.post("/api/refresh", (req, res) => {
  const what = String(req.body?.what || "");
  const run = RUNNERS[what];
  if (!run) return res.status(400).json({ error: "未知刷新目标" });
  if (jobs[what] && jobs[what].status === "running") return res.json({ status: "running" });
  jobs[what] = { status: "running", startedAt: Date.now() };
  run()
    .then(() => { jobs[what] = { status: "done", finishedAt: Date.now() }; })
    .catch((e) => { console.error("[refresh]", what, e.message); jobs[what] = { status: "error", finishedAt: Date.now(), error: e.message || "刷新失败" }; });
  res.status(202).json({ status: "started" });
});
app.get("/api/refresh/status", (req, res) => {
  res.json(jobs[String(req.query?.what || "")] || { status: "idle" });
});

app.get("/api/health", (req, res) => res.json({ ok: true, model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash", search: "bocha" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`车企洞察终端 运行于 http://localhost:${PORT}`);
  if (!process.env.DEEPSEEK_API_KEY) console.warn("⚠ 未设置 DEEPSEEK_API_KEY,板块数据接口会报错");
  if (!process.env.BOCHA_API_KEY) console.warn("⚠ 未设置 BOCHA_API_KEY,联网搜索会报错");
  startCron();
});
