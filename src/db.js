// 零依赖 JSON 文件存储(原子写入)。规模小,免去原生编译;接口与 SQL 版一致。
import fs from "node:fs";
import path from "node:path";

const FILE = process.env.DB_PATH || "./data.json";

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch (_) { return { subscribers: {}, digests: {} }; }
}
let store = load();

function persist() {
  const dir = path.dirname(FILE);
  if (dir && dir !== "." && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, FILE); // 原子替换,避免半截写入
}

export function addSubscriber(email) {
  if (store.subscribers[email]?.active) return false; // 已存在
  store.subscribers[email] = { created_at: new Date().toISOString(), active: true };
  persist();
  return true; // 新增
}

export function removeSubscriber(email) {
  if (store.subscribers[email]) { store.subscribers[email].active = false; persist(); }
}

export function listSubscribers() {
  return Object.entries(store.subscribers).filter(([, v]) => v.active).map(([e]) => e);
}

export function saveDigest(date, payload) {
  store.digests[date] = { payload, created_at: new Date().toISOString() };
  persist();
}

export function getDigest(date) {
  return store.digests[date]?.payload || null;
}
