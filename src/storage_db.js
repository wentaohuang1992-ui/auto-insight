// 存储洞察(升级):storage.json。集合:
//  categories 产品类别 {id,name,unit,labels[],contract[],spot[],source,caps[],manual,updatedAt}
//     caps:[{id,spec,contract,spot,contractMoM,spotMoM}]
//  feed 情报流 {id,source(tf/cfm/gn),title,url,date,insight,createdAt}
//  opinion {text,updatedAt}
import { readStore, writeStore, resolveStorePath } from "./store.js";
const P = resolveStorePath("STORAGE_PATH", "storage.json");
const now = () => new Date().toISOString();
const sid = (p) => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const numArr = (a) => (Array.isArray(a) ? a : String(a || "").split(/[,，\s]+/)).map(x => { const n = parseFloat(x); return isNaN(n) ? null : n; }).filter(x => x != null);

const LBL = ["25-07", "25-08", "25-09", "25-10", "25-11", "25-12", "26-01", "26-02", "26-03", "26-04", "26-05", "26-06"];
const SRC = "合约价:TrendForce(集邦) · 现货价:ChinaFlashMarket(闪存市场) · 单位:美元/8Gb 等效";
const CATS = [
  {
    id: "LPDDR4X", name: "LPDDR4X", unit: "美元 / 8Gb 等效", labels: LBL, source: SRC,
    contract: [1.80, 1.85, 1.90, 2.00, 2.10, 2.25, 2.40, 2.55, 2.70, 2.85, 2.95, 3.05],
    spot: [1.75, 1.95, 1.88, 2.10, 2.30, 2.20, 2.55, 2.75, 2.65, 3.00, 3.10, 3.20],
    caps: [
      ["LPDDR4X 4Gb", 1.65, 1.78, 4.2, 5.6], ["LPDDR4X 8Gb", 3.05, 3.20, 3.4, 3.2], ["LPDDR4X 16Gb", 6.10, 6.45, 3.1, 4.0],
    ],
  },
  {
    id: "LPDDR5X", name: "LPDDR5X", unit: "美元 / 8Gb 等效", labels: LBL, source: SRC,
    contract: [2.60, 2.65, 2.75, 2.90, 3.05, 3.20, 3.40, 3.60, 3.85, 4.05, 4.25, 4.40],
    spot: [2.55, 2.80, 2.78, 3.05, 3.25, 3.15, 3.55, 3.80, 3.75, 4.20, 4.40, 4.55],
    caps: [
      ["LPDDR5X 8Gb", 4.40, 4.55, 3.5, 3.4], ["LPDDR5X 12GB(模组)", 6.60, 6.85, 3.8, 4.2], ["LPDDR5X 16GB(模组)", 8.80, 9.20, 4.0, 4.8],
    ],
  },
];
const OPINION = '近半年存储进入上行周期:**LPDDR5X** 受 AI 终端 + HBM 挤占产能影响,合约价稳步上行;**LPDDR4X** 在成熟制程减产下同样补涨。现货价波动更大、领先合约价见顶/见底,可作为合约价的**先行信号**。(示例,可编辑)';

function mkCaps(arr) { return arr.map(([spec, c, s, cm, sm]) => ({ id: sid("cap"), spec, contract: c, spot: s, contractMoM: cm, spotMoM: sm })); }
function blank() { return { categories: [], feed: [], opinion: { text: "", updatedAt: null }, updatedAt: null }; }
function load() { return { ...blank(), ...readStore(P, blank) }; }
function save(db) { db.updatedAt = now(); return writeStore(P, db); }

export function ensureSeeded() {
  const db = load(); let ch = false;
  if (!db.categories.length) { db.categories = CATS.map(c => ({ ...c, caps: mkCaps(c.caps), manual: false, updatedAt: now() })); ch = true; }
  if (!db.opinion.text) { db.opinion = { text: OPINION, updatedAt: now() }; ch = true; }
  if (ch) save(db);
  return db;
}
export function getAll() { const db = ensureSeeded(); return { categories: db.categories, feed: db.feed.slice(0, 40), opinion: db.opinion, meta: { updatedAt: db.updatedAt, feed: db.feed.length } }; }

const findCat = (db, id) => db.categories.find(c => c.id === id);
export function putCategory(id, patch) {
  const db = ensureSeeded(); const c = findCat(db, id); if (!c) return null;
  if (patch.name != null) c.name = patch.name;
  if (patch.unit != null) c.unit = patch.unit;
  if (patch.source != null) c.source = patch.source;
  c.manual = true; c.updatedAt = now(); save(db); return c;
}
export function setSeries(id, { labels, contract, spot }) {
  const db = ensureSeeded(); const c = findCat(db, id); if (!c) return null;
  if (labels != null) c.labels = Array.isArray(labels) ? labels : String(labels).split(/[,，\s]+/).filter(Boolean);
  if (contract != null) c.contract = numArr(contract);
  if (spot != null) c.spot = numArr(spot);
  c.manual = true; c.updatedAt = now(); save(db); return c;
}
export function appendPoint(id, { label, contract, spot }) {
  const db = ensureSeeded(); const c = findCat(db, id); if (!c) return null;
  c.labels = [...(c.labels || []), label]; c.contract = [...(c.contract || []), parseFloat(contract)]; c.spot = [...(c.spot || []), parseFloat(spot)];
  c.manual = true; c.updatedAt = now(); save(db); return c;
}
export function addCategory(rec) {
  const db = ensureSeeded(); const id = (rec.id || rec.name || "").replace(/\s+/g, ""); if (!id || findCat(db, id)) return null;
  db.categories.push({ id, name: rec.name || id, unit: rec.unit || "美元 / 8Gb 等效", labels: [], contract: [], spot: [], source: rec.source || "", caps: [], manual: true, updatedAt: now() });
  save(db); return findCat(db, id);
}
export function delCategory(id) { const db = ensureSeeded(); const n = db.categories.length; db.categories = db.categories.filter(c => c.id !== id); save(db); return n !== db.categories.length; }

// caps
export function putCap(catId, capId, patch) {
  const db = ensureSeeded(); const c = findCat(db, catId); if (!c) return null;
  if (capId === "__new__") { const cap = { id: sid("cap"), spec: patch.spec || "", contract: +patch.contract || null, spot: +patch.spot || null, contractMoM: patch.contractMoM == null ? null : +patch.contractMoM, spotMoM: patch.spotMoM == null ? null : +patch.spotMoM }; c.caps.push(cap); }
  else { const cap = c.caps.find(x => x.id === capId); if (!cap) return null; Object.assign(cap, { spec: patch.spec ?? cap.spec, contract: patch.contract == null ? cap.contract : +patch.contract, spot: patch.spot == null ? cap.spot : +patch.spot, contractMoM: patch.contractMoM == null ? cap.contractMoM : +patch.contractMoM, spotMoM: patch.spotMoM == null ? cap.spotMoM : +patch.spotMoM }); }
  c.updatedAt = now(); save(db); return c;
}
export function delCap(catId, capId) { const db = ensureSeeded(); const c = findCat(db, catId); if (!c) return false; const n = c.caps.length; c.caps = c.caps.filter(x => x.id !== capId); save(db); return n !== c.caps.length; }

export function setFeed(items) {
  const db = ensureSeeded();
  const mapped = (items || []).filter(x => x && x.title).map((x, i) => ({ id: "f" + Date.now() + "_" + i, source: ["tf", "cfm", "gn"].includes(x.source) ? x.source : "gn", title: x.title, url: x.url || "", date: x.date || "", insight: x.insight || "", createdAt: now() }));
  db.feed = [...mapped, ...db.feed].slice(0, 60); save(db); return mapped.length;
}
export function setOpinion(text) { const db = ensureSeeded(); db.opinion = { text: text || "", updatedAt: now() }; save(db); return db.opinion; }
