// 主库(data.json):订阅者 / 板块快照 / 日报归档。存储层见 store.js(原子写入 + 损坏保护)。
import { readStore, writeStore, resolveStorePath } from "./store.js";

const FILE = process.env.DB_PATH || resolveStorePath(null, "data.json");
// 日报归档保留天数;超出的按日期从旧到新裁掉,避免 data.json 无限膨胀。
const KEEP_DAYS = Math.max(7, Number(process.env.DIGEST_KEEP_DAYS || 180));

const blank = () => ({ subscribers: {}, digests: {}, snapshots: {} });
let store = { ...blank(), ...readStore(FILE, blank) };

function persist() {
  writeStore(FILE, store);
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
function pruneDigests() {
  const keys = Object.keys(store.digests).sort(); // 升序,旧的在前
  if (keys.length <= KEEP_DAYS) return 0;
  const drop = keys.slice(0, keys.length - KEEP_DAYS);
  for (const k of drop) delete store.digests[k];
  console.log(`[db] 日报归档裁剪:移除 ${drop.length} 天(保留最近 ${KEEP_DAYS} 天)`);
  return drop.length;
}
export function saveDigest(iso, payload) {
  store.digests[iso] = { payload, created_at: new Date().toISOString() };
  pruneDigests();
  persist();
}
export function getDigest(iso) { return store.digests[iso]?.payload || null; }
export function listDigests() {
  return Object.keys(store.digests).sort().reverse()
    .map((iso) => ({ iso, date: store.digests[iso].payload?.date || iso }));
}
