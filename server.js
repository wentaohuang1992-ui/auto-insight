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
import * as findb from "./src/fin_db.js";
import { seedAllFin, seedOneCompanyFin } from "./src/fin_seed.js";
import { seedCompanyEM, seedAllEM, pickAShare } from "./src/fin_em.js";
import * as dsdb from "./src/ds_db.js";
import { updateDownshift } from "./src/ds_seed.js";
import * as clouddb from "./src/cloud_db.js";
import { updateCloud } from "./src/cloud_seed.js";
import * as stdb from "./src/storage_db.js";
import { updateStorage } from "./src/storage_seed.js";

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

app.get("/api/storage", (req, res) => { try { res.json(stdb.getAll()); } catch (e) { fail(res)(e); } });
app.put("/api/storage/categories/:id", (req, res) => { const r = stdb.putCategory(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到类别" }); res.json({ ok: true, row: r }); });
app.post("/api/storage/categories", (req, res) => { const r = stdb.addCategory(req.body || {}); if (!r) return res.status(409).json({ error: "类别已存在或缺名称" }); res.json({ ok: true, row: r }); });
app.delete("/api/storage/categories/:id", (req, res) => res.json({ ok: stdb.delCategory(req.params.id) }));
app.put("/api/storage/series/:id", (req, res) => { const r = stdb.setSeries(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到类别" }); res.json({ ok: true, row: r }); });
app.post("/api/storage/series/:id/append", (req, res) => { const r = stdb.appendPoint(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到类别" }); res.json({ ok: true, row: r }); });
app.put("/api/storage/caps/:catId/:capId", (req, res) => { const r = stdb.putCap(req.params.catId, req.params.capId, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.delete("/api/storage/caps/:catId/:capId", (req, res) => res.json({ ok: stdb.delCap(req.params.catId, req.params.capId) }));
app.put("/api/storage/opinion", (req, res) => res.json({ ok: true, opinion: stdb.setOpinion(req.body?.text || "") }));
app.post("/api/storage/update", (req, res) => {
  const key = "storage-update";
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running" });
  jobs[key] = { status: "running", startedAt: Date.now() };
  updateStorage().then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; }).catch((e) => { console.error("[storage-update]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
});

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

// —— 车企财务数据库(companies / salesMonthly / quarterly / parts) ——
app.get("/api/fin", (req, res) => { try { res.json(findb.getAll()); } catch (e) { fail(res)(e); } });
// 车企
app.post("/api/fin/companies", (req, res) => { const r = findb.addCompany(req.body || {}); if (!r) return res.status(409).json({ error: "车企已存在或名称为空" }); res.json({ ok: true, company: r }); });
app.put("/api/fin/companies/:id", (req, res) => { const r = findb.putCompany(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到车企" }); res.json({ ok: true, company: r }); });
app.delete("/api/fin/companies/:id", (req, res) => res.json({ ok: findb.deleteCompany(req.params.id) }));
// 季度财务
app.post("/api/fin/quarterly", (req, res) => { const r = findb.upsertQuarterly(req.body || {}, { manual: true }); if (!r.ok) return res.status(400).json({ error: "缺少 company/year/q" }); res.json(r); });
app.put("/api/fin/quarterly/:id", (req, res) => { const r = findb.putQuarterly(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到季度记录" }); res.json({ ok: true, row: r }); });
app.delete("/api/fin/quarterly/:id", (req, res) => res.json({ ok: findb.deleteQuarterly(req.params.id) }));
// 月度销量
app.post("/api/fin/sales", (req, res) => { const r = findb.upsertSales(req.body || {}, { manual: true }); if (!r.ok) return res.status(400).json({ error: "缺少 company/year/month" }); res.json(r); });
app.put("/api/fin/sales/:id", (req, res) => { const r = findb.putSales(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到月销记录" }); res.json({ ok: true, row: r }); });
// 自研部件
app.post("/api/fin/parts", (req, res) => { const r = findb.addPart(req.body || {}); if (!r) return res.status(409).json({ error: "该部件已存在或缺少 company/part" }); res.json({ ok: true, part: r }); });
app.put("/api/fin/parts/:id", (req, res) => { const r = findb.putPart(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到部件记录" }); res.json({ ok: true, part: r }); });
app.delete("/api/fin/parts/:id", (req, res) => res.json({ ok: findb.deletePart(req.params.id) }));

// 单车企财报抓取(定向、异步)
app.post("/api/fin/seed-company", (req, res) => {
  const name = String(req.body?.company || "").trim();
  if (!name) return res.status(400).json({ error: "缺少 company" });
  const key = "fincompany:" + name;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  jobs[key] = { status: "running", startedAt: Date.now() };
  seedOneCompanyFin(name)
    .then(() => { jobs[key] = { status: "done", finishedAt: Date.now() }; })
    .catch((e) => { console.error("[fin-seed-company]", name, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "抓取失败" }; });
  res.status(202).json({ status: "started", key });
});

// 东方财富(A股)·试抓预览:浏览器可直接打开,返回解析结果但不保存(便于核对/排错)
app.get("/api/fin/em-probe", (req, res) => {
  const name = String(req.query?.company || "").trim();
  if (!name) return res.status(400).json({ error: "缺少 company,例:/api/fin/em-probe?company=赛力斯" });
  seedCompanyEM(name, { save: false }).then((d) => res.json(d)).catch((e) => res.status(500).json({ error: e.message }));
});
// 东方财富(A股)·抓取入库(定向、异步,存为草稿 manual:false)
app.post("/api/fin/em-seed-company", (req, res) => {
  const name = String(req.body?.company || "").trim();
  if (!name) return res.status(400).json({ error: "缺少 company" });
  const key = "emcompany:" + name;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  jobs[key] = { status: "running", startedAt: Date.now() };
  seedCompanyEM(name, { save: true })
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
    .catch((e) => { console.error("[em-seed-company]", name, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "抓取失败" }; });
  res.status(202).json({ status: "started", key });
});

// ===== 中低端智驾市场洞察 =====
app.get("/api/downshift", (req, res) => { try { res.json(dsdb.getAll()); } catch (e) { fail(res)(e); } });
app.put("/api/downshift/penetration/:id", (req, res) => { const r = dsdb.putPenetration(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.put("/api/downshift/tiers/:id", (req, res) => { const r = dsdb.tiers.put(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.post("/api/downshift/chips", (req, res) => res.json({ ok: true, row: dsdb.chips.add(req.body || {}) }));
app.put("/api/downshift/chips/:id", (req, res) => { const r = dsdb.chips.put(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.delete("/api/downshift/chips/:id", (req, res) => res.json({ ok: dsdb.chips.del(req.params.id) }));
app.put("/api/downshift/opinion", (req, res) => res.json({ ok: true, opinion: dsdb.setOpinion(req.body?.text || "") }));
app.post("/api/downshift/update", (req, res) => {
  const key = "ds-update";
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running" });
  jobs[key] = { status: "running", startedAt: Date.now() };
  updateDownshift().then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; }).catch((e) => { console.error("[ds-update]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
});

// ===== 云算力成本洞察 =====
app.get("/api/cloud", (req, res) => { try { res.json(clouddb.getAll()); } catch (e) { fail(res)(e); } });
app.put("/api/cloud/prices/:id", (req, res) => { const r = clouddb.prices.put(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.put("/api/cloud/chips/:id", (req, res) => { const r = clouddb.chips.put(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.post("/api/cloud/corehour", (req, res) => res.json({ ok: true, row: clouddb.coreHour.add(req.body || {}) }));
app.put("/api/cloud/corehour/:id", (req, res) => { const r = clouddb.coreHour.put(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, row: r }); });
app.delete("/api/cloud/corehour/:id", (req, res) => res.json({ ok: clouddb.coreHour.del(req.params.id) }));
app.put("/api/cloud/params", (req, res) => res.json({ ok: true, params: clouddb.setParams(req.body || {}) }));
app.put("/api/cloud/roi", (req, res) => res.json({ ok: true, roi: clouddb.setRoi(req.body || {}) }));
app.put("/api/cloud/scenarios", (req, res) => res.json({ ok: true, scenarios: clouddb.setScenarios(req.body || {}) }));
app.put("/api/cloud/opinion", (req, res) => res.json({ ok: true, opinion: clouddb.setOpinion(req.body?.text || "") }));
app.post("/api/cloud/update", (req, res) => {
  const key = "cloud-update";
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running" });
  jobs[key] = { status: "running", startedAt: Date.now() };
  updateCloud().then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; }).catch((e) => { console.error("[cloud-update]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
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

const RUNNERS = { fin: refreshFinancials, cadence: refreshCadence, storage: refreshStorage, news: generateDaily, models: seedModels, "fin-seed": seedAllFin };
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
