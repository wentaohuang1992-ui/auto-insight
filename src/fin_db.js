// 车企洞察数据库:持久化(financials.json)。四张逻辑表:
//  companies   车企基础  {id,name,type(core/competitor),kind(新势力/传统车企),ticker,listing,note,manual,sources,updatedAt}
//  salesMonthly 月度销量  {id,company,year,month,sales,sources,note,manual,updatedAt}
//  quarterly   季度财务+财经运营(当季口径)
//              {id,company,year,q, revenue,netProfit,operatingCost,inventory,ap,rdSpend,sales,
//               ocf,cash,stDebt,ltDebt,ar,financingCF,totalAssets,totalLiab,invFinished,invRaw,
//               retailReg,dealerCoef,rdCap, sources,note,manual,updatedAt}
//  parts       自研智驾部件追踪(主题3)  {id,company,part,selfDev(自研/外购/混合),stage,product,replace,note,sources,manual,updatedAt}
// 手改记录(manual:true)不被自动种子/增量覆盖。
import { readStore, writeStore, resolveStorePath } from "./store.js";

const FIN_PATH = resolveStorePath("FIN_PATH", "financials.json");

const now = () => new Date().toISOString();
const slug = (s) => String(s || "").replace(/\s+/g, "").trim().toLowerCase();
const qid = (company, year, q) => `${company}:${year}Q${q}`;
const mid = (company, year, month) => `${company}:${year}-${String(month).padStart(2, "0")}`;
const pid = (company, part) => `${company}:${slug(part)}`;

// reviews:财报解读(2026-08 新增顶层键)。按 CLAUDE.md 第 4 条,加进 blank() 即可,
// 靠 { ...blank(), ...readStore(...) } 的展开顺序自动兼容老文件,不需要迁移。
function blank() { return { companies: [], salesMonthly: [], quarterly: [], parts: [], reviews: [], statements: [], updatedAt: null }; }
function load() { return { ...blank(), ...readStore(FIN_PATH, blank) }; }
function save(db) { db.updatedAt = now(); return writeStore(FIN_PATH, db); }

// —— 预置 15 家车企(核心伙伴 8 + 主要竞品 7) ——
const PRESET = [
  { name: "赛力斯", type: "core", kind: "传统车企", ticker: "601127.SH", listing: "A股", note: "问界(鸿蒙智行)" },
  { name: "北汽", type: "core", kind: "传统车企", ticker: "600733.SH / 1958.HK", listing: "A+H", note: "享界(鸿蒙智行);上市主体北汽蓝谷/北京汽车" },
  { name: "奇瑞汽车", type: "core", kind: "传统车企", ticker: "09973.HK", listing: "H股", note: "智界(鸿蒙智行)+ 出口" },
  { name: "上汽集团", type: "core", kind: "传统车企", ticker: "600104.SH", listing: "A股", note: "尚界(鸿蒙智行)" },
  { name: "江淮", type: "core", kind: "传统车企", ticker: "600418.SH", listing: "A股", note: "尊界(鸿蒙智行)" },
  { name: "长安汽车", type: "core", kind: "传统车企", ticker: "000625.SZ", listing: "A股", note: "阿维塔/深蓝(华为合作);阿维塔未独立上市,以长安代" },
  { name: "东风", type: "core", kind: "传统车企", ticker: "600006.SH", listing: "A股", note: "岚图/猛士(华为乾崑);上市主体东风汽车/东风集团" },
  { name: "广汽集团", type: "core", kind: "传统车企", ticker: "601238.SH / 2238.HK", listing: "A+H", note: "昊铂/启境(华为乾崑)" },
  { name: "比亚迪", type: "competitor", kind: "传统车企", ticker: "002594.SZ / 1211.HK", listing: "A+H", note: "新能源销量龙头,垂直整合" },
  { name: "吉利汽车", type: "competitor", kind: "传统车企", ticker: "00175.HK", listing: "H股", note: "极氪/领克/银河" },
  { name: "长城汽车", type: "competitor", kind: "传统车企", ticker: "601633.SH / 2333.HK", listing: "A+H", note: "哈弗/坦克/魏牌/欧拉" },
  { name: "理想汽车", type: "competitor", kind: "新势力", ticker: "02015.HK / LI", listing: "H+美", note: "增程 SUV,直营" },
  { name: "零跑汽车", type: "competitor", kind: "新势力", ticker: "09863.HK", listing: "H股", note: "性价比 + 出海" },
  { name: "小鹏汽车", type: "competitor", kind: "新势力", ticker: "09868.HK / XPEV", listing: "H+美", note: "智驾标杆,直营" },
  { name: "蔚来汽车", type: "competitor", kind: "新势力", ticker: "09866.HK / NIO", listing: "H+美", note: "换电 + 乐道/萤火虫,直营" },
];

// —— 预置自研智驾部件追踪(主题3 起步样例,可编辑/扩充) ——
const PRESET_PARTS = [
  { company: "蔚来汽车", part: "智驾SoC", selfDev: "自研", stage: "量产", product: "神玑 NX9031", replace: "英伟达 Orin" },
  { company: "蔚来汽车", part: "智能座舱", selfDev: "自研", stage: "量产", product: "自研座舱方案", replace: "高通" },
  { company: "小鹏汽车", part: "智驾SoC", selfDev: "自研", stage: "流片/上车", product: "图灵芯片", replace: "英伟达" },
  { company: "理想汽车", part: "智驾SoC", selfDev: "自研", stage: "研发", product: "自研智驾芯片", replace: "英伟达 Thor" },
  { company: "比亚迪", part: "智驾SoC", selfDev: "混合", stage: "部分量产", product: "自研+地平线/英伟达", replace: "—" },
  { company: "吉利汽车", part: "座舱SoC", selfDev: "自研", stage: "量产", product: "芯擎 龍鹰一号", replace: "高通" },
];

function cleanCompany(r) {
  return {
    name: r.name || "", type: r.type === "competitor" ? "competitor" : "core",
    kind: r.kind === "新势力" ? "新势力" : "传统车企",
    ticker: r.ticker || "", listing: r.listing || "", note: r.note || "",
    sources: Array.isArray(r.sources) ? r.sources : [],
  };
}
const NUM = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return isNaN(n) ? null : n; };
function cleanQ(r) {
  const o = {};
  for (const k of ["revenue", "netProfit", "operatingCost", "inventory", "ap", "rdSpend",
    "ocf", "cash", "stDebt", "ltDebt", "ar", "financingCF", "totalAssets", "totalLiab", "invFinished", "invRaw", "dealerCoef", "rdCap",
    // —— 2026-08 新增可选字段(只加不改;老记录读出来是 undefined → NUM 转成 null,既有逻辑不受影响) ——
    // netProfitEx 扣非归母 / govGrant 政府补助 / jvIncome 合联营投资收益 / overseasPct 海外收入占比(%)
    // 前三个合起来回答一个问题:这家的利润是主业赚的,还是补助和投资收益撑起来的。
    "netProfitEx", "govGrant", "jvIncome", "overseasPct"])
    o[k] = NUM(r[k]);
  o.sales = r.sales == null ? null : Math.round(NUM(r.sales) || 0);
  o.retailReg = r.retailReg == null ? null : Math.round(NUM(r.retailReg) || 0);
  o.sources = Array.isArray(r.sources) ? r.sources : [];
  o.note = r.note || "";
  return o;
}
function cleanPart(r) {
  return {
    part: r.part || "", selfDev: r.selfDev || "外购", stage: r.stage || "—",
    product: r.product || "", replace: r.replace || "", note: r.note || "",
    sources: Array.isArray(r.sources) ? r.sources : [],
  };
}

// ============ 初始化 ============
export function ensureSeeded() {
  const db = load();
  let changed = false;
  if (!db.companies.length) {
    db.companies = PRESET.map((c) => ({ id: slug(c.name), ...cleanCompany(c), manual: false, updatedAt: now() }));
    changed = true;
  }
  if (!db.parts.length) {
    db.parts = PRESET_PARTS.map((p) => ({ id: pid(slug(p.company), p.part), company: slug(p.company), ...cleanPart(p), manual: false, updatedAt: now() }));
    changed = true;
  }
  if (changed) save(db);
  return db;
}

// ============ 读取 ============
export function getAll() {
  const db = ensureSeeded();
  return {
    companies: db.companies, salesMonthly: db.salesMonthly, quarterly: db.quarterly, parts: db.parts,
    reviews: db.reviews || [], statements: db.statements || [],
    meta: { companies: db.companies.length, quarterly: db.quarterly.length, salesMonthly: db.salesMonthly.length, parts: db.parts.length, reviews: (db.reviews || []).length, statements: (db.statements || []).length, updatedAt: db.updatedAt },
  };
}
export function listCompanies() { return ensureSeeded().companies; }
export function getCompany(id) { return ensureSeeded().companies.find((c) => c.id === id) || null; }

// ============ 车企 CRUD ============
export function addCompany(rec) {
  const db = ensureSeeded();
  const id = slug(rec.name);
  if (!id || db.companies.some((c) => c.id === id)) return null;
  const r = { id, ...cleanCompany(rec), manual: true, updatedAt: now() };
  db.companies.push(r); save(db); return r;
}
export function putCompany(id, patch) {
  const db = ensureSeeded();
  const i = db.companies.findIndex((c) => c.id === id);
  if (i < 0) return null;
  db.companies[i] = { ...db.companies[i], ...patch, id, manual: true, updatedAt: now() };
  save(db); return db.companies[i];
}
export function deleteCompany(id) {
  const db = ensureSeeded();
  const n = db.companies.length;
  db.companies = db.companies.filter((c) => c.id !== id);
  db.quarterly = db.quarterly.filter((q) => q.company !== id);
  db.salesMonthly = db.salesMonthly.filter((m) => m.company !== id);
  db.parts = db.parts.filter((p) => p.company !== id);
  if (Array.isArray(db.statements)) db.statements = db.statements.filter((s) => s.company !== id);
  save(db); return n !== db.companies.length;
}

// ============ 季度财务 ============
export function upsertQuarterly(rec, { manual = false } = {}) {
  if (!rec || !rec.company || !rec.year || !rec.q) return { skipped: "invalid" };
  const db = ensureSeeded();
  const id = qid(rec.company, rec.year, rec.q);
  const i = db.quarterly.findIndex((x) => x.id === id);
  if (i >= 0) {
    if (db.quarterly[i].manual && !manual) return { skipped: "manual", id };
    db.quarterly[i] = { ...db.quarterly[i], company: rec.company, year: +rec.year, q: +rec.q, ...cleanQ(rec), id, manual, updatedAt: now() };
  } else {
    db.quarterly.push({ id, company: rec.company, year: +rec.year, q: +rec.q, ...cleanQ(rec), manual, updatedAt: now() });
  }
  save(db); return { ok: true, id };
}
export function putQuarterly(id, patch) {
  const db = ensureSeeded();
  const i = db.quarterly.findIndex((x) => x.id === id);
  if (i < 0) return null;
  db.quarterly[i] = { ...db.quarterly[i], ...cleanQ({ ...db.quarterly[i], ...patch }), id, manual: true, updatedAt: now() };
  save(db); return db.quarterly[i];
}
export function deleteQuarterly(id) {
  const db = ensureSeeded(); const n = db.quarterly.length;
  db.quarterly = db.quarterly.filter((x) => x.id !== id); save(db); return n !== db.quarterly.length;
}

// ============ 完整财务三表(as-reported,按报告期整行存;数值单位=元,前端换算) ============
function stmtId(company, period) { return `${company}:${period}`; }
function cleanStmtRows(o) {
  const r = {};
  if (o && typeof o === "object") for (const k in o) {
    if (k === "REPORT_DATE") { r[k] = o[k]; continue; }
    const n = NUM(o[k]); if (n != null) r[k] = n;
  }
  return r;
}
export function upsertStatement(rec, { manual = false } = {}) {
  if (!rec || !rec.company || !rec.period) return { skipped: "invalid" };
  const db = ensureSeeded();
  if (!Array.isArray(db.statements)) db.statements = [];
  const id = stmtId(rec.company, rec.period);
  const clean = {
    id, company: rec.company, period: rec.period,
    year: +rec.year || null, q: +rec.q || null, reportType: rec.reportType || "", label: rec.label || rec.period,
    income: cleanStmtRows(rec.income), balance: cleanStmtRows(rec.balance), cashflow: cleanStmtRows(rec.cashflow),
    sources: Array.isArray(rec.sources) ? rec.sources : [], manual, updatedAt: now(),
  };
  const i = db.statements.findIndex((x) => x.id === id);
  if (i >= 0) { if (db.statements[i].manual && !manual) return { skipped: "manual", id }; db.statements[i] = clean; }
  else db.statements.push(clean);
  save(db); return { ok: true, id };
}

// ============ 月度销量 ============
export function upsertSales(rec, { manual = false } = {}) {
  if (!rec || !rec.company || !rec.year || !rec.month) return { skipped: "invalid" };
  const db = ensureSeeded();
  const id = mid(rec.company, rec.year, rec.month);
  const i = db.salesMonthly.findIndex((x) => x.id === id);
  const val = { company: rec.company, year: +rec.year, month: +rec.month, sales: Math.round(NUM(rec.sales) || 0), ytd: NUM(rec.ytd), nev: NUM(rec.nev), nevYtd: NUM(rec.nevYtd), overseas: NUM(rec.overseas), overseasYtd: NUM(rec.overseasYtd), sources: Array.isArray(rec.sources) ? rec.sources : [], note: rec.note || "" };
  if (i >= 0) {
    if (db.salesMonthly[i].manual && !manual) return { skipped: "manual", id };
    db.salesMonthly[i] = { ...db.salesMonthly[i], ...val, id, manual, updatedAt: now() };
  } else {
    db.salesMonthly.push({ id, ...val, manual, updatedAt: now() });
  }
  save(db); return { ok: true, id };
}
export function putSales(id, patch) {
  const db = ensureSeeded();
  const i = db.salesMonthly.findIndex((x) => x.id === id);
  if (i < 0) return null;
  db.salesMonthly[i] = { ...db.salesMonthly[i], ...patch, sales: Math.round(NUM(patch.sales ?? db.salesMonthly[i].sales) || 0), id, manual: true, updatedAt: now() };
  save(db); return db.salesMonthly[i];
}

// ============ 自研部件 ============
export function upsertPart(rec, { manual = false } = {}) {
  if (!rec || !rec.company || !rec.part) return { skipped: "invalid" };
  const db = ensureSeeded();
  const id = pid(rec.company, rec.part);
  const i = db.parts.findIndex((x) => x.id === id);
  if (i >= 0) {
    if (db.parts[i].manual && !manual) return { skipped: "manual", id };
    db.parts[i] = { ...db.parts[i], company: rec.company, ...cleanPart(rec), id, manual, updatedAt: now() };
  } else {
    db.parts.push({ id, company: rec.company, ...cleanPart(rec), manual, updatedAt: now() });
  }
  save(db); return { ok: true, id };
}
export function putPart(id, patch) {
  const db = ensureSeeded();
  const i = db.parts.findIndex((x) => x.id === id);
  if (i < 0) return null;
  db.parts[i] = { ...db.parts[i], ...cleanPart({ ...db.parts[i], ...patch }), id, manual: true, updatedAt: now() };
  save(db); return db.parts[i];
}
export function addPart(rec) {
  const db = ensureSeeded();
  const id = pid(slug(rec.company), rec.part);
  if (db.parts.some((p) => p.id === id)) return null;
  const r = { id, company: slug(rec.company), ...cleanPart(rec), manual: true, updatedAt: now() };
  db.parts.push(r); save(db); return r;
}
export function deletePart(id) {
  const db = ensureSeeded(); const n = db.parts.length;
  db.parts = db.parts.filter((x) => x.id !== id); save(db); return n !== db.parts.length;
}

// ============ 财报解读 ============
// 一家车企一个期间一条,重跑覆盖。人工编辑过的(manual:true)不被自动生成覆盖。
export function upsertReview(rec, { manual = false } = {}) {
  if (!rec || !rec.company || !rec.year || !rec.q) return { skipped: "invalid" };
  const db = ensureSeeded();
  db.reviews = db.reviews || [];
  const id = `${rec.company}:${rec.year}Q${rec.q}`;
  const i = db.reviews.findIndex((x) => x.id === id);
  if (i >= 0) {
    if (db.reviews[i].manual && !manual) return { skipped: "manual", id };
    db.reviews[i] = { ...db.reviews[i], ...rec, id, manual, updatedAt: now() };
  } else {
    db.reviews.push({ id, ...rec, manual, updatedAt: now() });
  }
  save(db);
  return { ok: true, id };
}
export function getReview(company, year, q) {
  const db = ensureSeeded();
  return (db.reviews || []).find((x) => x.id === `${company}:${year}Q${q}`) || null;
}
export function listReviews(company) {
  const db = ensureSeeded();
  const rs = (db.reviews || []).filter((x) => !company || x.company === company);
  return rs.sort((a, b) => b.year - a.year || b.q - a.q);
}
export function deleteReview(id) {
  const db = ensureSeeded();
  db.reviews = db.reviews || [];
  const n = db.reviews.length;
  db.reviews = db.reviews.filter((x) => x.id !== id);
  save(db);
  return n !== db.reviews.length;
}

export { slug };
