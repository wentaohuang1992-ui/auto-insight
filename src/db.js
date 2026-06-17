// 零依赖 JSON 文件存储(原子写入)。
import fs from "node:fs";
import path from "node:path";

const FILE = process.env.DB_PATH || "./data.json";

function load() {
  let parsed = {};
  try { parsed = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (_) {}
  return { subscribers: {}, digests: {}, snapshots: {}, ...parsed };
}
let store = load();

function persist() {
  const dir = path.dirname(FILE);
  if (dir && dir !== "." && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, FILE);
}

// 订阅
export function addSubscriber(email) {
  if (store.subscribers[email]?.active) return false;
  store.subscribers[email] = { created_at: new Date().toISOString(), active: true };
  persist(); return true;
}
export function listSubscribers() {
  return Object.entries(store.subscribers).filter(([, v]) => v.active).map(([e]) => e);
}

// 最新快照(财报 / 上市)
export function saveSnapshot(kind, payload) {
  store.snapshots[kind] = { payload, updated_at: new Date().toISOString() };
  persist();
}
export function getSnapshot(kind) { return store.snapshots[kind] || null; }

// 日报(按 iso 日期归档)
export function saveDigest(iso, payload) {
  store.digests[iso] = { payload, created_at: new Date().toISOString() };
  persist();
}
export function getDigest(iso) { return store.digests[iso]?.payload || null; }
export function listDigests() {
  return Object.keys(store.digests).sort().reverse()
    .map((iso) => ({ iso, date: store.digests[iso].payload?.date || iso }));
}
