import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDetail } from "./src/claude.js";
import { generateCadence } from "./src/cadence.js";
import { addSubscriber, getSnapshot, saveSnapshot, getDigest, listDigests, listDigestFailures, saveHeadlines, getHeadlines, saveReport, getReport, listReports } from "./src/db.js";
import { genHeadlines, headlineChannels } from "./src/headlines.js";
import { fetchReportLinks } from "./src/fin_reports.js";
import { genReport, weeksOfMonth } from "./src/reports.js";
import { startCron, refreshFinancials, refreshCadence, refreshStorage, generateDaily, backfillDigests, digestStatus } from "./src/cron.js";
import { today } from "./src/dates.js";
import { listModels, getModel, putModel, addModel, deleteModel, dbMeta } from "./src/models_db.js";
import { seedModels, seedOneBrand } from "./src/models_seed.js";
import { brandMarket } from "./src/market.js";
import * as findb from "./src/fin_db.js";
import { seedAllFin, seedOneCompanyFin } from "./src/fin_seed.js";
import { seedCompanyEM, seedAllEM, pickAShare } from "./src/fin_em.js";
import { seedCompanyHK, seedAllHK, pickHK } from "./src/fin_hk.js";
import { runWatch, watchStatus } from "./src/fin_watch.js";
import { probeSales } from "./src/sales_probe.js";
import { fetchSales, fetchAllSales } from "./src/sales_fetch.js";
import { importSeed, coverage as finCoverage } from "./src/fin_import.js";
import { generateReview, generateAllReviews } from "./src/fin_review.js";
import * as flash from "./src/fin_flash.js";
import * as dsdb from "./src/ds_db.js";
import { updateDownshift } from "./src/ds_seed.js";
import * as clouddb from "./src/cloud_db.js";
import { updateCloud } from "./src/cloud_seed.js";
import * as stdb from "./src/storage_db.js";
import { updateStorage } from "./src/storage_seed.js";
import { apiGuard, adminConfigured, tooSoon, overBudget, budgetLeft, cleanName } from "./src/guard.js";
import { lockedStores, storageInfo } from "./src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 进程真实启动时刻(由 process.uptime() 反推,比模块加载时刻准)。
// 用途:排查"改了环境变量到底生效没有"时,能一眼看出当前进程是什么时候起来的 ——
// 如果 startedAt 早于改环境变量的时间,那就是还没重启,而不是配置写错了。
const STARTED_AT = new Date(Date.now() - process.uptime() * 1000);
function humanUptime(sec) {
  const s = Math.floor(sec), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} 天 ${h} 小时 ${m} 分`;
  if (h) return `${h} 小时 ${m} 分`;
  if (m) return `${m} 分 ${s % 60} 秒`;
  return `${s} 秒`;
}
const app = express();
app.set("trust proxy", 1); // Railway 等平台在前面有反向代理,限流需要真实 IP
app.use(express.json());
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "请求体不是合法 JSON" });
  next(err);
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", apiGuard); // 写接口需要 ADMIN_TOKEN;公开接口按 IP 限流

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
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已触发过,请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
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

// —— 周报 / 月报(综合) ——
app.get("/api/reports", (req, res) => { try { res.json({ items: listReports() }); } catch (e) { fail(res)(e); } });
// 某年某月包含哪些周(前端三级选择用)
app.get("/api/reports/weeks", (req, res) => {
  const y = Number(req.query.year), m = Number(req.query.month);
  if (!y || !m || m < 1 || m > 12) return res.status(400).json({ error: "year/month 不合法" });
  try { res.json({ items: weeksOfMonth(y, m) }); } catch (e) { fail(res)(e); }
});
app.get("/api/reports/item", (req, res) => {
  const key = String(req.query.key || "").trim();
  if (!/^[WM]:[\d-]+$/.test(key)) return res.status(400).json({ error: "key 形如 W:2026-08-24 或 M:2026-08" });
  const cached = getReport(key);
  if (cached) return res.json(cached);
  genReport(key).then((d) => { saveReport(key, d); res.json(d); }).catch(fail(res));
});
app.post("/api/reports/refresh", apiGuard, (req, res) => {
  const key = String((req.body && req.body.key) || "").trim();
  if (!/^[WM]:[\d-]+$/.test(key)) return res.status(400).json({ error: "key 形如 W:2026-08-24 或 M:2026-08" });
  const jk = "report-" + key;
  if (jobs[jk] && jobs[jk].status === "running") return res.json({ status: "running" });
  const wait = tooSoon(jk); if (wait) return res.status(429).json({ error: `刚触发过,请 ${wait} 秒后再试` });
  jobs[jk] = { status: "running", startedAt: Date.now() };
  genReport(key).then((d) => { saveReport(key, d); jobs[jk] = { status: "done", finishedAt: Date.now() }; })
    .catch((e) => { console.error("[report]", e.message); jobs[jk] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
});
// 财报原文 PDF:巨潮(A股)/披露易(港股)真实公告链接
app.get("/api/fin/reports", (req, res) => {
  const name = String(req.query.company || "").trim();
  if (!name) return res.status(400).json({ error: "缺少 company" });
  const c = ((findb.getAll() || {}).companies || []).find((x) => x.name === name || x.id === name);
  if (!c) return res.status(404).json({ error: "未知车企:" + name });
  const t = String(c.ticker || "").toUpperCase();
  const mA = t.match(/(\d{6})\.(SH|SZ)/), mH = t.match(/(\d{4,5})\.HK/);
  const entity = { id: c.id, name: c.name };
  if (mA) entity.aShare = `${mA[1]}.${mA[2]}`;
  if (mH) entity.hk = `${mH[1].padStart(5, "0")}.HK`;
  if (!entity.aShare && !entity.hk) return res.json({ name: c.name, links: [], warns: ["无可识别的 A股/港股代码"] });
  fetchReportLinks(entity).then((d) => res.json(d)).catch(fail(res));
});
// 今日要闻(频道:launch 新车·销量 / fin 财务·融资)。GET 读最新;没有则同步生成一次。
app.get("/api/headlines", (req, res) => {
  const ch = String(req.query.channel || "").trim();
  if (!headlineChannels().includes(ch)) return res.status(400).json({ error: "channel 必须是 launch 或 fin" });
  (async () => { let d = getHeadlines(ch); if (!d) { d = await genHeadlines(ch); saveHeadlines(ch, d); } return d; })()
    .then((d) => res.json(d)).catch(fail(res));
});
// 手动刷新某频道要闻(写操作,需要 ADMIN_TOKEN)
app.post("/api/headlines/refresh", apiGuard, (req, res) => {
  const ch = String((req.body && req.body.channel) || "").trim();
  if (!headlineChannels().includes(ch)) return res.status(400).json({ error: "channel 必须是 launch 或 fin" });
  const key = "headlines-" + ch;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running" });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚触发过,请 ${wait} 秒后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  genHeadlines(ch).then((d) => { saveHeadlines(ch, d); jobs[key] = { status: "done", finishedAt: Date.now(), count: d.items.length }; })
    .catch((e) => { console.error("[headlines]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
});
// 手动触发补漏(需要 ADMIN_TOKEN,走 apiGuard)。平时不用调:启动时和每天日报任务后
// 会自动跑。这个口子是给"刚修好上游、不想等到明早"的场合用的。
// 预算与单轮上限由 backfillDigests 内部把关,这里不额外放行。
app.post("/api/news/backfill", (req, res) => {
  // 补漏关着的时候,backfillDigests 内部会直接跳过。要是这里照样回 202「已启动」,
  // 调用方会以为触发成功了,其实什么都没发生 —— 所以先在门口挡掉。
  if (!digestStatus().backfillEnabled) {
    return res.status(409).json({ error: "补漏已关闭(DIGEST_BACKFILL=0);要用请改环境变量并重启服务" });
  }
  const key = "digest-backfill";
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running" });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已触发过,请 ${wait} 秒后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  backfillDigests("手动触发")
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
    .catch((e) => { console.error("[digest-backfill]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
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
  const brand = cleanName(req.query?.brand);
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
  const name = cleanName(req.body?.company);
  if (!name) return res.status(400).json({ error: "缺少 company" });
  const key = "fincompany:" + name;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已抓取过 ${name},请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
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
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已抓取过 ${name},请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  seedCompanyEM(name, { save: true })
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
    .catch((e) => { console.error("[em-seed-company]", name, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "抓取失败" }; });
  res.status(202).json({ status: "started", key });
});

// 港股 F10(补 A 股源覆盖不到的 6 家:奇瑞/吉利/理想/零跑/小鹏/蔚来)·试抓预览,不保存
app.get("/api/fin/hk-probe", (req, res) => {
  const name = String(req.query?.company || "").trim();
  if (!name) return res.status(400).json({ error: "缺少 company,例:/api/fin/hk-probe?company=吉利汽车" });
  seedCompanyHK(name, { save: false, halfYear: req.query?.halfYear === "1" })
    .then((d) => res.json(d)).catch((e) => res.status(500).json({ error: e.message }));
});
// 港股 F10·抓取入库(定向、异步,存为草稿 manual:false)
app.post("/api/fin/hk-seed-company", (req, res) => {
  const name = String(req.body?.company || "").trim();
  if (!name) return res.status(400).json({ error: "缺少 company" });
  const key = "hkcompany:" + name;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已抓取过 ${name},请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  seedCompanyHK(name, { save: true, halfYear: req.body?.halfYear === true })
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
    .catch((e) => { console.error("[hk-seed-company]", name, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "抓取失败" }; });
  res.status(202).json({ status: "started", key });
});

// —— 财报速递:一张横表,每家一行,每个报告期「发布时间 + 财报总结」两列 ——
app.get("/api/fin/flash", (req, res) => { try { res.json(flash.getAll()); } catch (e) { fail(res)(e); } });
app.post("/api/fin/flash", (req, res) => {
  const name = cleanName(req.body?.company, 20);
  const group = req.body?.group === "整车" || req.body?.group === "供应商" ? req.body.group : null;
  const key = "flash:" + (name || group || "all");
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已生成过,请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  const run = name
    ? flash.generateFlash(name, { withSearch: req.body?.withSearch !== false })
    : flash.generateAllFlash({ group, withSearch: req.body?.withSearch !== false });
  run.then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
     .catch((e) => { console.error("[fin-flash]", name || group || "all", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "生成失败" }; });
  res.status(202).json({ status: "started", key });
});
// —— 财报哨兵:每天盯新财报,发现即同步进车企视图库并刷新速递。自诊断:GET 看上次完整报告 ——
app.get("/api/fin/watch", (req, res) => { try { res.json(watchStatus()); } catch (e) { fail(res)(e); } });
app.post("/api/fin/watch/run", (req, res) => {
  const key = "fin-watch";
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  runWatch({ apply: req.body?.apply !== false }) // apply:false 为演练(不写库、不重生成,只报告会发现什么)
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
    .catch((e) => { console.error("[fin-watch]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started", key });
});
// —— 产销快报探路:探官方公告正文能不能解析出销量数字(决定月度销量怎么抓) ——
app.get("/api/fin/sales-probe", (req, res) => {
  probeSales(cleanName(req.query.company, 20) || "比亚迪").then((d) => res.json(d)).catch(fail(res));
});
// —— 产销快报月度销量:取官方正文 → DeepSeek 抽当月/累计销量合计 → 入库 salesMonthly ——
app.get("/api/fin/sales-fetch", (req, res) => {
  fetchSales(cleanName(req.query.company, 20) || "比亚迪", { months: +req.query.months || 6, apply: req.query.dry !== "1" })
    .then((d) => res.json(d)).catch(fail(res));
});
app.post("/api/fin/sales/fetch-all", (req, res) => {
  const key = "sales-fetch";
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  fetchAllSales({ months: +(req.body && req.body.months) || 6 })
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; })
    .catch((e) => { console.error("[sales-fetch]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started", key });
});
// 名单与报告期维护
app.post("/api/fin/flash/entities", (req, res) => { const r = flash.addEntity(req.body || {}); if (!r) return res.status(409).json({ error: "已存在或缺名称" }); res.json({ ok: true, entity: r }); });
app.put("/api/fin/flash/entities/:id", (req, res) => { const r = flash.putEntity(req.params.id, req.body || {}); if (!r) return res.status(404).json({ error: "未找到" }); res.json({ ok: true, entity: r }); });
app.delete("/api/fin/flash/entities/:id", (req, res) => res.json({ ok: flash.deleteEntity(req.params.id) }));
app.put("/api/fin/flash/periods", (req, res) => { const r = flash.setPeriods(req.body?.periods); if (!r) return res.status(400).json({ error: "periods 必须是非空数组" }); res.json({ ok: true, periods: r }); });

// —— 财报解读:一键「自动抓数据 → 算指标与信号 → 生成结构化解读」——
// 读:公开;生成:要令牌 + 最短间隔 + 全局预算(会打东方财富和 DeepSeek)
app.get("/api/fin/review", (req, res) => {
  try {
    const { company, year, q } = req.query || {};
    if (company && year && q) {
      const r = findb.getReview(findb.slug(company) === company ? company : findb.slug(company), +year, +q);
      return r ? res.json(r) : res.status(404).json({ error: "还没有这一期的解读,先生成" });
    }
    res.json({ items: findb.listReviews(company || null) });
  } catch (e) { fail(res)(e); }
});
app.post("/api/fin/review", (req, res) => {
  const name = cleanName(req.body?.company);
  if (!name) return res.status(400).json({ error: "缺少 company" });
  const key = "review:" + name;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已生成过 ${name},请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  generateReview(name, { year: req.body?.year || null, q: req.body?.q || null, refetchData: req.body?.refetch !== false })
    .then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: { period: `${r.year}Q${r.q}`, grade: r.grade, mode: r.mode, signals: r.signals_detail.length } }; })
    .catch((e) => { console.error("[fin-review]", name, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "生成失败" }; });
  res.status(202).json({ status: "started", key });
});
app.delete("/api/fin/review/:id", (req, res) => res.json({ ok: findb.deleteReview(req.params.id) }));

// —— 种子导入(交易所/监管接口直采 + 媒体交叉核对的一批历史季度数据) ——
// 预览:只算不写,看清楚要插多少、覆盖多少、有几条因为你手改过而保留
app.get("/api/fin/import-preview", (req, res) => {
  try { res.json(importSeed({ apply: false, company: req.query?.company || null })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
// 覆盖率体检:哪家、哪个字段还是空的,以及该用哪个源去补。排查"数据怎么这么多缺"先看这个。
app.get("/api/fin/coverage", (req, res) => {
  try { res.json(finCoverage({ minYear: Number(req.query?.since) || 2025 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
// 落库:必须显式 apply:true。手改过的记录(manual:true)默认不覆盖。
app.post("/api/fin/import", (req, res) => {
  try {
    res.json(importSeed({
      apply: req.body?.apply === true,
      company: req.body?.company || null,
      overwriteManual: req.body?.overwriteManual === true,
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已触发过,请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
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
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已触发过,请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  updateCloud().then((r) => { jobs[key] = { status: "done", finishedAt: Date.now(), result: r }; }).catch((e) => { console.error("[cloud-update]", e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message }; });
  res.status(202).json({ status: "started" });
});

const jobs = {}; // what -> {status:'running'|'done'|'error', startedAt, finishedAt, error}

// 单品牌重新抓取(定向、异步)
app.post("/api/models/seed-brand", (req, res) => {
  const brand = cleanName(req.body?.brand);
  if (!brand) return res.status(400).json({ error: "缺少 brand" });
  const key = "brand:" + brand;
  if (jobs[key] && jobs[key].status === "running") return res.json({ status: "running", key });
  const wait = tooSoon(key); if (wait) return res.status(429).json({ error: `刚刚已抓取过 ${brand},请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[key] = { status: "running", startedAt: Date.now() };
  seedOneBrand(brand)
    .then(() => { jobs[key] = { status: "done", finishedAt: Date.now() }; })
    .catch((e) => { console.error("[seed-brand]", brand, e.message); jobs[key] = { status: "error", finishedAt: Date.now(), error: e.message || "抓取失败" }; });
  res.status(202).json({ status: "started", key });
});

const RUNNERS = { fin: refreshFinancials, cadence: refreshCadence, storage: refreshStorage, news: generateDaily, models: seedModels, "fin-seed": seedAllFin,
  // A 股全量。seedAllEM 之前只 import 了没接路由,等于一直没法一键跑 —— 补上。
  "fin-em": seedAllEM,
  // 港股全量:只跑没有 A 股代码的那几家,不和东方财富 A 股源抢同一家
  "fin-hk": () => seedAllHK({ halfYear: false }),
  // 一键补齐财务库。顺序是有讲究的:
  //   先两个报表源(A股 → 港股)把三大报表灌满,最后再用种子「只填空」补上
  //   报表里没有的东西(季度销量、扣非、政府补助、合联营投资收益、海外收入占比)。
  //   反过来先导种子的话,后面的报表源虽然会覆盖自己那几项,但顺序乱了不好排查。
  // 全量财报解读:每家抓一次数 + 生成一份最新期解读
  "fin-flash": () => flash.generateAllFlash({}),
  "fin-flash-oem": () => flash.generateAllFlash({ group: "整车" }),
  "fin-flash-sup": () => flash.generateAllFlash({ group: "供应商" }),
  "fin-review": () => generateAllReviews({ onlyCore: false }),
  "fin-review-core": () => generateAllReviews({ onlyCore: true }),
  "fin-all": async () => {
    const em = await seedAllEM();
    const hk = await seedAllHK({ halfYear: false });
    const imp = importSeed({ apply: true });
    return { aShare: em, hk, seedImport: { saved: imp.saved, filled: imp.fieldsToFill } };
  } };
app.post("/api/refresh", (req, res) => {
  const what = String(req.body?.what || "");
  const run = RUNNERS[what];
  if (!run) return res.status(400).json({ error: "未知刷新目标" });
  if (jobs[what] && jobs[what].status === "running") return res.json({ status: "running" });
  const wait = tooSoon("refresh:" + what); if (wait) return res.status(429).json({ error: `刚刚已触发过,请 ${wait} 秒后再试` });
  const over = overBudget(); if (over) return res.status(429).json({ error: `抓取任务已达每小时上限,请 ${over} 分钟后再试` });
  jobs[what] = { status: "running", startedAt: Date.now() };
  run()
    .then(() => { jobs[what] = { status: "done", finishedAt: Date.now() }; })
    .catch((e) => { console.error("[refresh]", what, e.message); jobs[what] = { status: "error", finishedAt: Date.now(), error: e.message || "刷新失败" }; });
  res.status(202).json({ status: "started" });
});
app.get("/api/refresh/status", (req, res) => {
  res.json(jobs[String(req.query?.what || "")] || { status: "idle" });
});

app.get("/api/health", (req, res) => {
  const locked = lockedStores();
  const upSec = process.uptime();
  const failLimit = Math.min(50, Math.max(1, Number(req.query?.failures) || 10));
  res.json({
    ok: locked.length === 0,
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    search: "bocha",
    // 进程什么时候起来的。改完环境变量后对一下这个时间就知道有没有真的重启过。
    startedAt: STARTED_AT.toISOString(),
    startedAtLocal: STARTED_AT.toLocaleString("zh-CN", { timeZone: process.env.CRON_TZ || "Asia/Shanghai" }),
    uptimeSec: Math.round(upSec),
    uptime: humanUptime(upSec),
    adminToken: adminConfigured() ? "已配置" : "未配置(写接口对外开放)",
    jobBudgetLeft: budgetLeft(), // 本小时还能触发多少次抓取任务
    storage: storageInfo(),       // persistent:false 表示数据在临时盘,重新部署就会丢
    lockedStores: locked, // 非空表示某个数据文件损坏、已停止写入,需要人工处理
    // 日报健康度:今天生成了没、最近哪几天还缺、上一轮补漏干了什么
    digest: digestStatus(),
    // 最近 N 次日报生成失败(默认 10,?failures=50 可多看几条)。
    // 有了这个就不用去翻 Railway 日志:失败日期 + 错误原文 + 试了几次都在这。
    digestFailures: listDigestFailures(failLimit),
  });
});

// 兜底错误处理:此前路由里未捕获的异常会直接落到 express 默认处理器,返回一段 HTML 堆栈。
app.use((err, req, res, next) => {
  console.error("[server]", req.method, req.originalUrl, err && err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err && err.message ? err.message : "服务端错误" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`车企洞察终端 运行于 http://localhost:${PORT}`);
  if (!process.env.DEEPSEEK_API_KEY) console.warn("⚠ 未设置 DEEPSEEK_API_KEY,板块数据接口会报错");
  if (!process.env.BOCHA_API_KEY) console.warn("⚠ 未设置 BOCHA_API_KEY,联网搜索会报错");
  startCron();
});
