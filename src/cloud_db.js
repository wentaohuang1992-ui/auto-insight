// 云算力成本洞察:cloud.json。集合:
//  prices 云厂商行情 {id,vendor,chip,price,unit,mom,yoy,supply,note,sources,manual}
//  priceIndex 价格指数 [number]  (近12点,最新在末)
//  chips AI芯片供需 {id,name,position,tightness,leadtime,trend,note,sources,manual}
//  coreHour 月度 {id,ym,trainCH,simCH,unitCost,monthCost,adsVer,note,manual}  (内部,手工)
//  params {passThrough}  roi {invest,output,ratio,marginalTrend,note}
//  scenarios {a:[],b:[]}  opinion {text,updatedAt}
import fs from "fs";
import path from "path";
const P = process.env.CLOUD_PATH
  || (process.env.DB_PATH ? path.join(path.dirname(process.env.DB_PATH), "cloud.json") : path.join(process.cwd(), "cloud.json"));
const now = () => new Date().toISOString();
const sid = (p) => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const PRICES = [
  { vendor: "华为云", chip: "昇腾 910B 集群", price: "", unit: "元/卡·时", mom: -4, yoy: -11, supply: "紧平衡" },
  { vendor: "阿里云", chip: "GPU(H800 等)", price: "", unit: "元/卡·时", mom: -9, yoy: -22, supply: "缓和" },
  { vendor: "腾讯云", chip: "H20 实例", price: "", unit: "元/卡·时", mom: -7, yoy: -18, supply: "缓和" },
  { vendor: "火山引擎", chip: "GPU", price: "", unit: "元/卡·时", mom: -8, yoy: -20, supply: "缓和" },
  { vendor: "AWS", chip: "H100(海外对标)", price: "", unit: "$/卡·时", mom: 2, yoy: -12, supply: "回稳" },
];
const CHIPS = [
  { name: "NVIDIA H200 / B200", position: "训练旗舰", tightness: "偏紧", leadtime: "较长", trend: "坚挺" },
  { name: "NVIDIA H20(中国版)", position: "合规训练/推理", tightness: "缓和", leadtime: "正常", trend: "走低" },
  { name: "昇腾 910B / 910C", position: "国产训练主力", tightness: "紧平衡", leadtime: "排产中", trend: "缓降" },
];
const INDEX = [100, 96, 97, 90, 85, 83, 78, 74, 72, 69, 66, 62];
const COREHOUR = ["M-5", "M-4", "M-3", "M-2", "M-1", "本月"].map((m) => ({ ym: m, trainCH: null, simCH: null, unitCost: null, monthCost: null, adsVer: "ADS x.x" }));
const PARAMS = { passThrough: 0.6 };
const ROI = { invest: "¥X 万", output: "ADS 能力↑ / 装机↑", ratio: "1 : N", marginalTrend: "仍为正", note: "投入=算力+相关研发;产出口径待定(示例)" };
const SCEN = {
  a: ["把超额利润转化为关键版本加速迭代,抢装机/订单窗口", "趁价格低位锁价/扩容训练资源", "研发费用同步上台阶,管理投入产出叙事"],
  b: ["放缓非关键训练/仿真任务,压低当期 Core-Hour 支出", "用错峰/竞价实例、自建昇腾替代高价外采", "可资本化研发支出与费用化合理切分,平滑利润"],
};
const OPINION = '本月业界算力价格指数环比 **−6%**(GPU 缓和、昇腾紧平衡);同期 ADS 迭代使训练算力需求同比 **+38%**,量增价跌部分对冲,我们 Core-Hour 综合成本环比约 **−3%**。若趋势延续,Q4 训练预算有下行空间——建议优先用于**加速关键版本迭代**(投产比仍高),而非单纯利润平滑。(示例,可编辑)';

function blank() { return { prices: [], priceIndex: [], chips: [], coreHour: [], params: { ...PARAMS }, roi: { ...ROI }, scenarios: { a: [], b: [] }, opinion: { text: "", updatedAt: null }, updatedAt: null }; }
function load() { try { return { ...blank(), ...JSON.parse(fs.readFileSync(P, "utf8")) }; } catch { return blank(); } }
function save(db) { db.updatedAt = now(); try { fs.mkdirSync(path.dirname(P), { recursive: true }); } catch {} fs.writeFileSync(P, JSON.stringify(db, null, 2)); return db; }

export function ensureSeeded() {
  const db = load(); let ch = false;
  if (!db.prices.length) { db.prices = PRICES.map(p => ({ id: sid("p"), ...p, note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.priceIndex.length) { db.priceIndex = INDEX.slice(); ch = true; }
  if (!db.chips.length) { db.chips = CHIPS.map(c => ({ id: sid("c"), ...c, note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.coreHour.length) { db.coreHour = COREHOUR.map(m => ({ id: sid("h"), ...m, note: "", manual: false, updatedAt: now() })); ch = true; }
  if (!db.opinion.text) { db.opinion = { text: OPINION, updatedAt: now() }; ch = true; }
  if (ch) save(db);
  return db;
}
export function getAll() {
  const db = ensureSeeded();
  return { prices: db.prices, priceIndex: db.priceIndex, chips: db.chips, coreHour: db.coreHour, params: db.params, roi: db.roi, scenarios: db.scenarios, opinion: db.opinion, meta: { updatedAt: db.updatedAt } };
}

function crud(coll) {
  return {
    put(id, patch) { const db = ensureSeeded(); const i = db[coll].findIndex(x => x.id === id); if (i < 0) return null; db[coll][i] = { ...db[coll][i], ...patch, id, manual: true, updatedAt: now() }; save(db); return db[coll][i]; },
    add(rec) { const db = ensureSeeded(); const r = { id: sid(coll[0]), ...rec, manual: true, updatedAt: now() }; db[coll].push(r); save(db); return r; },
    del(id) { const db = ensureSeeded(); const n = db[coll].length; db[coll] = db[coll].filter(x => x.id !== id); save(db); return n !== db[coll].length; },
    upsertBy(keyField, rec, { manual = false } = {}) { const db = ensureSeeded(); const i = db[coll].findIndex(x => x[keyField] === rec[keyField]); if (i >= 0) { if (db[coll][i].manual && !manual) return { skipped: "manual" }; db[coll][i] = { ...db[coll][i], ...rec, manual, updatedAt: now() }; } else db[coll].push({ id: sid(coll[0]), ...rec, manual, updatedAt: now() }); save(db); return { ok: true }; },
  };
}
export const prices = crud("prices");
export const chips = crud("chips");
export const coreHour = crud("coreHour");

export function setParams(p) { const db = ensureSeeded(); db.params = { ...db.params, ...p }; save(db); return db.params; }
export function setRoi(r) { const db = ensureSeeded(); db.roi = { ...db.roi, ...r }; save(db); return db.roi; }
export function setScenarios(s) { const db = ensureSeeded(); db.scenarios = { a: s.a || db.scenarios.a, b: s.b || db.scenarios.b }; save(db); return db.scenarios; }
export function setOpinion(text) { const db = ensureSeeded(); db.opinion = { text: text || "", updatedAt: now() }; save(db); return db.opinion; }
export function pushIndex(v) { const db = ensureSeeded(); if (v != null && !isNaN(+v)) { db.priceIndex.push(+v); db.priceIndex = db.priceIndex.slice(-12); save(db); } return db.priceIndex; }
