// 中低端智驾市场洞察:downshift.json。集合:
//  penetration 渗透矩阵 {id(band::config),band,config,value,trend,note,sources,manual}
//  tiers 方案档位 {id,tier,priceBand,bom,chip,ability,sensor,note,sources,manual}
//  chips 国产芯片动向 {id,name,tops,position,status,models,note,sources,manual}
//  feed 情报流 {id,kind(noa/vis/chip),title,source,url,date,insight,createdAt}
//  opinion 决策观点 {text,updatedAt}
import { readStore, writeStore, resolveStorePath } from "./store.js";

const P = resolveStorePath("DS_PATH", "downshift.json");
const now = () => new Date().toISOString();
const slug = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

const BANDS = ["≤10万", "10-15万", "15-20万", "20-30万", ">30万"];
const CONFIGS = ["高速NOA", "城市NOA", "行泊一体", "纯视觉方案", "激光雷达", "高阶座舱"];
// 预置渗透率示例 [value, trend]，行=band 列=config
const PEN = {
  "≤10万": [[18, 12], [2, 2], [34, 20], [86, 9], [1, 0], [22, 10]],
  "10-15万": [[47, 18], [12, 10], [61, 24], [72, 6], [8, 6], [41, 15]],
  "15-20万": [[73, 14], [38, 26], [80, 12], [48, 11], [35, 18], [66, 12]],
  "20-30万": [[88, 5], [64, 22], [85, 4], [29, 9], [68, 10], [82, 6]],
  ">30万": [[95, 0], [86, 14], [90, 0], [12, -3], [89, 3], [93, 0]],
};
const TIERS = [
  { tier: "入门 · 纯视觉行泊一体", priceBand: "≤10万", bom: "¥2–4k", chip: "地平线 J6E / 黑芝麻 A1000", ability: "高速NOA·记忆泊车", sensor: "纯视觉,无激光" },
  { tier: "中阶 · 轻量城市NOA", priceBand: "15–20万", bom: "¥6–10k", chip: "征程6M / 华山A2000", ability: "城市NOA(纯视觉或1激光)", sensor: "纯视觉 或 1 激光" },
  { tier: "高阶 · 全场景城市NOA", priceBand: ">20万", bom: "¥15–25k", chip: "华为 / 英伟达Thor / J6P", ability: "全场景城市NOA", sensor: "1–2 激光 + 大算力" },
];
const CHIPS = [
  { name: "地平线 征程6E/M", tops: "80–128", position: "中阶 行泊一体/轻NOA", status: "量产上车", models: "多家 10–20 万车型" },
  { name: "地平线 征程6P", tops: "560", position: "高阶 城市NOA", status: "上车中", models: "20 万级旗舰" },
  { name: "黑芝麻 华山A1000/A2000", tops: "58 / 250+", position: "行泊一体→城市NOA", status: "上车中", models: "东风/多家" },
  { name: "爱芯 / 芯擎 等", tops: "—", position: "入门行泊一体/座舱", status: "导入期", models: "示例" },
];
const OPINION = '当前**高速 NOA + 行泊一体**已凭纯视觉 + 国产芯片下探到 **10–15 万**带；**城市 NOA** 的降本临界点正落在 **15–20 万**——这也是下沉竞争最激烈的战场。对高阶激光雷达方案的供应商而言，真正的较量发生在“15–20 万能不能用得起城市 NOA”。(示例,可编辑)';

function blank() { return { penetration: [], tiers: [], chips: [], feed: [], opinion: { text: "", updatedAt: null }, updatedAt: null }; }
function load() { return { ...blank(), ...readStore(P, blank) }; }
function save(db) { db.updatedAt = now(); return writeStore(P, db); }

export function ensureSeeded() {
  const db = load(); let ch = false;
  if (!db.penetration.length) { for (const b of BANDS) CONFIGS.forEach((c, i) => db.penetration.push({ id: b + "::" + c, band: b, config: c, value: PEN[b][i][0], trend: PEN[b][i][1], note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.tiers.length) { db.tiers = TIERS.map((t, i) => ({ id: "tier" + (i + 1), ...t, note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.chips.length) { db.chips = CHIPS.map((c, i) => ({ id: "chip" + (i + 1), ...c, note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.opinion.text) { db.opinion = { text: OPINION, updatedAt: now() }; ch = true; }
  if (ch) save(db);
  return db;
}
export function getAll() {
  const db = ensureSeeded();
  return { penetration: db.penetration, tiers: db.tiers, chips: db.chips, feed: db.feed.slice(0, 40), opinion: db.opinion, bands: BANDS, configs: CONFIGS, meta: { updatedAt: db.updatedAt, feed: db.feed.length } };
}

// 渗透率
export function putPenetration(id, patch) {
  const db = ensureSeeded(); const i = db.penetration.findIndex(x => x.id === id); if (i < 0) return null;
  const v = patch.value, t = patch.trend;
  db.penetration[i] = { ...db.penetration[i], value: v == null || v === "" ? null : +v, trend: t == null || t === "" ? null : +t, note: patch.note ?? db.penetration[i].note, manual: true, updatedAt: now() };
  save(db); return db.penetration[i];
}
export function upsertPenetration(rec, { manual = false } = {}) {
  if (!rec || !rec.band || !rec.config) return { skipped: "invalid" };
  const db = ensureSeeded(); const id = rec.band + "::" + rec.config; const i = db.penetration.findIndex(x => x.id === id);
  if (i >= 0) { if (db.penetration[i].manual && !manual) return { skipped: "manual" }; db.penetration[i] = { ...db.penetration[i], value: rec.value ?? null, trend: rec.trend ?? null, sources: rec.sources || [], manual, updatedAt: now() }; }
  else db.penetration.push({ id, band: rec.band, config: rec.config, value: rec.value ?? null, trend: rec.trend ?? null, note: "", sources: rec.sources || [], manual, updatedAt: now() });
  save(db); return { ok: true };
}
// 通用 tiers/chips
function crud(coll) {
  return {
    put(id, patch) { const db = ensureSeeded(); const i = db[coll].findIndex(x => x.id === id); if (i < 0) return null; db[coll][i] = { ...db[coll][i], ...patch, id, manual: true, updatedAt: now() }; save(db); return db[coll][i]; },
    add(rec) { const db = ensureSeeded(); const id = coll + "_" + slug(rec.name || rec.tier || Date.now()) + "_" + Math.random().toString(36).slice(2, 6); db[coll].push({ id, ...rec, manual: true, updatedAt: now() }); save(db); return db[coll][db[coll].length - 1]; },
    del(id) { const db = ensureSeeded(); const n = db[coll].length; db[coll] = db[coll].filter(x => x.id !== id); save(db); return n !== db[coll].length; },
  };
}
export const tiers = crud("tiers");
export const chips = crud("chips");

// 情报流
export function setFeed(items) { const db = ensureSeeded(); const mapped = (items || []).filter(x => x && x.title).map((x, i) => ({ id: "f" + Date.now() + "_" + i, kind: ["noa", "vis", "chip"].includes(x.kind) ? x.kind : "noa", title: x.title, source: x.source || "", url: x.url || "", date: x.date || "", insight: x.insight || "", createdAt: now() })); db.feed = [...mapped, ...db.feed].slice(0, 60); save(db); return mapped.length; }
export function setOpinion(text) { const db = ensureSeeded(); db.opinion = { text: text || "", updatedAt: now() }; save(db); return db.opinion; }
export { BANDS, CONFIGS };
