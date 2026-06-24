// 车型数据库:持久化的规范化车型记录(产品谱系 + 上市计划 + 配置)。
// 记录: {id, brand, group, model, body, priceFrom, priceRange, adas, hi, status,
//        launches:[{kind,year,month,date,estimated,note}], note, sources, manual, updatedAt}
import fs from "fs";
import path from "path";

const MODELS_PATH = process.env.MODELS_PATH
  || (process.env.DB_PATH ? path.join(path.dirname(process.env.DB_PATH), "models.json") : path.join(process.cwd(), "models.json"));

function now() { return new Date().toISOString(); }
function load() {
  try { return JSON.parse(fs.readFileSync(MODELS_PATH, "utf8")); }
  catch { return { models: [], updatedAt: null }; }
}
function save(db) {
  db.updatedAt = now();
  try { fs.mkdirSync(path.dirname(MODELS_PATH), { recursive: true }); } catch {}
  fs.writeFileSync(MODELS_PATH, JSON.stringify(db, null, 2));
  return db;
}
export function slugify(brand, model) {
  return `${String(brand || "").trim()}__${String(model || "").replace(/\s+/g, "").trim()}`.toLowerCase();
}
function clean(rec) {
  return {
    brand: rec.brand || "", group: rec.group || "", model: rec.model || "",
    body: rec.body || "", priceFrom: rec.priceFrom ?? null, priceRange: rec.priceRange || "",
    adas: rec.adas || "", hi: !!rec.hi, status: rec.status || "在售",
    launches: Array.isArray(rec.launches) ? rec.launches : [],
    note: rec.note || "", sources: Array.isArray(rec.sources) ? rec.sources : []
  };
}

export function listModels() { return load().models; }
export function getModel(id) { return load().models.find((m) => m.id === id) || null; }
export function dbMeta() { const db = load(); return { count: db.models.length, updatedAt: db.updatedAt }; }

// 种子/增量:写入或合并;手改过(manual:true)的记录不被自动覆盖
export function upsertModel(rec) {
  const db = load();
  const id = rec.id || slugify(rec.brand, rec.model);
  const i = db.models.findIndex((m) => m.id === id);
  if (i >= 0) {
    if (db.models[i].manual) return db.models[i]; // 保护手改记录
    db.models[i] = { ...db.models[i], ...clean(rec), id, manual: false, updatedAt: now() };
  } else {
    db.models.push({ id, ...clean(rec), manual: false, updatedAt: now() });
  }
  save(db);
  return db.models.find((m) => m.id === id);
}

// 手动编辑:打 manual 标记,后续种子不覆盖
export function putModel(id, patch) {
  const db = load();
  const i = db.models.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const merged = { ...db.models[i], ...patch, id, manual: true, updatedAt: now() };
  // 若改了 brand/model,重算 id 并迁移
  const newId = slugify(merged.brand, merged.model);
  merged.id = newId;
  db.models[i] = merged;
  if (newId !== id && db.models.some((m, j) => j !== i && m.id === newId)) {
    // 撞 id 则保留原 id,避免冲突
    merged.id = id;
  }
  save(db);
  return merged;
}

export function addModel(rec) {
  const db = load();
  const id = slugify(rec.brand, rec.model);
  if (db.models.some((m) => m.id === id)) return null;
  const r = { id, ...clean(rec), manual: true, updatedAt: now() };
  db.models.push(r); save(db); return r;
}

export function deleteModel(id) {
  const db = load();
  const n = db.models.length;
  db.models = db.models.filter((m) => m.id !== id);
  save(db);
  return n !== db.models.length;
}

export function replaceAll(models) {
  const db = { models: models.map((m) => ({ id: slugify(m.brand, m.model), ...clean(m), manual: !!m.manual, updatedAt: now() })) };
  return save(db);
}

// 增量合并:只覆盖 delta 提供的字段、追加上市计划;手改记录(manual)不动
export function mergeModel(delta) {
  if (!delta || !delta.brand || !delta.model) return { skipped: "invalid" };
  const db = load();
  const id = slugify(delta.brand, delta.model);
  const i = db.models.findIndex((m) => m.id === id);
  if (i < 0) {
    const rec = {
      id, ...clean({
        brand: delta.brand, group: delta.group || "", model: delta.model, body: delta.body,
        priceFrom: typeof delta.priceFrom === "number" ? delta.priceFrom : (parseFloat(delta.priceFrom) || null),
        priceRange: delta.priceRange, adas: delta.adas, hi: delta.hi, status: delta.status || "在售",
        launches: delta.launch ? [{ kind: delta.launch.kind || "新车", year: 2026, month: delta.launch.month || null, date: delta.launch.date || "", estimated: !!delta.launch.estimated, note: delta.launch.note || "" }] : [],
        note: delta.note, sources: delta.sources || (delta.source && delta.source.url ? [delta.source] : [])
      }), manual: false, src: "news", updatedAt: now()
    };
    db.models.push(rec); save(db); return { created: true, id };
  }
  const ex = db.models[i];
  if (ex.manual) return { skipped: "manual", id };
  const m = { ...ex };
  if (delta.body) m.body = delta.body;
  const pf = typeof delta.priceFrom === "number" ? delta.priceFrom : parseFloat(delta.priceFrom);
  if (!isNaN(pf) && pf) m.priceFrom = pf;
  if (delta.priceRange) m.priceRange = delta.priceRange;
  if (delta.adas) m.adas = delta.adas;
  if (typeof delta.hi === "boolean") m.hi = delta.hi;
  if (delta.status) m.status = delta.status;
  if (delta.note) m.note = delta.note;
  const newSrcs = (delta.sources || []).concat(delta.source && delta.source.url ? [delta.source] : []).filter((s) => s && s.url);
  if (newSrcs.length) {
    const cur = Array.isArray(m.sources) ? m.sources.slice() : [];
    const seen = new Set(cur.map((s) => s.url));
    for (const s of newSrcs) { if (!seen.has(s.url)) { cur.push(s); seen.add(s.url); } }
    m.sources = cur.slice(0, 4);
  }
  if (delta.launch) {
    m.launches = Array.isArray(m.launches) ? m.launches.slice() : [];
    const L = { kind: delta.launch.kind || "新车", year: 2026, month: delta.launch.month || null, date: delta.launch.date || "", estimated: !!delta.launch.estimated, note: delta.launch.note || "" };
    const j = m.launches.findIndex((x) => x.kind === L.kind && (x.month === L.month || (x.date && x.date === L.date)));
    if (j < 0) m.launches.push(L); else m.launches[j] = { ...m.launches[j], ...L };
  }
  m.src = "news"; m.updatedAt = now();
  db.models[i] = m; save(db); return { updated: true, id };
}
