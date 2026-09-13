// 信源清单存储:可在界面里增删改,而不是写死在代码里。
import { readStore, writeStore, resolveStorePath } from "./store.js";
import { DEFAULT_SOURCES } from "./feeds.js";

const PATH = resolveStorePath("FEEDS_PATH", "feeds.json");
const blank = () => ({ sources: [], lastPull: null, lastErrors: [], updatedAt: null });
const load = () => ({ ...blank(), ...readStore(PATH, blank) });
const save = (db) => { db.updatedAt = new Date().toISOString(); return writeStore(PATH, db); };

/** 首次使用时用默认清单播种;之后以库里的为准(你的增删不会被覆盖) */
export function listSources() {
  const db = load();
  if (!db.sources.length) { db.sources = DEFAULT_SOURCES.map((x) => ({ ...x })); save(db); }
  return db.sources;
}
export function addSource(rec) {
  const db = load(); listSources();
  const d = load();
  const id = rec.id || "s" + Date.now().toString(36);
  d.sources.push({ id, name: rec.name || "未命名", kind: rec.kind === "rss" ? "rss" : "list",
    url: rec.url || "", pattern: rec.pattern || "", weight: Number(rec.weight) || 5,
    tags: Array.isArray(rec.tags) ? rec.tags : [], on: rec.on !== false });
  save(d); return d.sources[d.sources.length - 1];
}
export function putSource(id, patch) {
  const db = load(); const i = db.sources.findIndex((x) => x.id === id);
  if (i < 0) return null;
  db.sources[i] = { ...db.sources[i], ...patch, id };
  save(db); return db.sources[i];
}
export function delSource(id) {
  const db = load(); const n = db.sources.length;
  db.sources = db.sources.filter((x) => x.id !== id);
  const ok = db.sources.length < n; if (ok) save(db); return ok;
}
export function recordPull(stats, errors) {
  const db = load();
  db.lastPull = { at: new Date().toISOString(), ...stats };
  db.lastErrors = errors || [];
  save(db);
}
export function pullStatus() { const db = load(); return { lastPull: db.lastPull, lastErrors: db.lastErrors, sources: db.sources.length }; }
