// 车企财务数据库:持久化(financials.json)。四张逻辑表:
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

function blank() { return { companies: [], salesMonthly: [], quarterly: [], parts: [], updatedAt: null }; }
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
    "ocf", "cash", "stDebt", "ltDebt", "ar", "financingCF", "totalAssets", "totalLiab", "invFinished", "invRaw", "dealerCoef", "rdCap"])
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
    meta: { companies: db.companies.length, quarterly: db.quarterly.length, salesMonthly: db.salesMonthly.length, parts: db.parts.length, updatedAt: db.updatedAt },
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

// ============ 月度销量 ============
export function upsertSales(rec, { manual = false } = {}) {
  if (!rec || !rec.company || !rec.year || !rec.month) return { skipped: "invalid" };
  const db = ensureSeeded();
  const id = mid(rec.company, rec.year, rec.month);
  const i = db.salesMonthly.findIndex((x) => x.id === id);
  const val = { company: rec.company, year: +rec.year, month: +rec.month, sales: Math.round(NUM(rec.sales) || 0), sources: Array.isArray(rec.sources) ? rec.sources : [], note: rec.note || "" };
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

export { slug };
