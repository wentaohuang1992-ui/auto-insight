// 主库(data.json):订阅者 / 板块快照 / 日报归档。存储层见 store.js(原子写入 + 损坏保护)。
import { readStore, writeStore, resolveStorePath } from "./store.js";

const FILE = process.env.DB_PATH || resolveStorePath(null, "data.json");
// 日报归档保留天数;超出的按日期从旧到新裁掉,避免 data.json 无限膨胀。
const KEEP_DAYS = Math.max(7, Number(process.env.DIGEST_KEEP_DAYS || 180));

// 失败记录保留条数。这是个环形日志,只用于排查,不参与任何业务逻辑。
const FAILURE_KEEP = Math.max(10, Number(process.env.DIGEST_FAILURE_KEEP || 50));

// 注意 digestFailures 是后加的键:老的 data.json 里没有它。下面 `{ ...blank(), ...readStore() }`
// 的展开顺序保证了缺失的顶层键会被空结构补上,所以老文件可以直接读,不需要迁移。
const blank = () => ({ subscribers: {}, digests: {}, snapshots: {}, digestFailures: [], headlines: {}, headlineArchive: {}, reports: {}, summaries: {} });
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

// 今日要闻(多频道:launch/fin):存最新一份 + 按日期归档(供周报/月报回溯)
const HL_KEEP_DAYS = Math.max(30, Number(process.env.HEADLINE_KEEP_DAYS || 400));
function pruneHeadlineArchive() {
  const a = store.headlineArchive || {};
  const keys = Object.keys(a).sort();                 // 升序,旧的在前
  const cut = new Date(Date.now() - HL_KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  for (const k of keys) { if (k < cut) delete a[k]; }
}
export function saveHeadlines(channel, payload) {
  store.headlines = store.headlines || {};
  store.headlines[channel] = { payload, updated_at: new Date().toISOString() };
  // 归档:headlineArchive[iso][channel] = payload
  const iso = (payload && payload.iso) || new Date().toISOString().slice(0, 10);
  store.headlineArchive = store.headlineArchive || {};
  store.headlineArchive[iso] = store.headlineArchive[iso] || {};
  store.headlineArchive[iso][channel] = { ...payload, archived_at: new Date().toISOString() };
  pruneHeadlineArchive();
  persist();
}
export function getHeadlines(channel) {
  const r = store.headlines && store.headlines[channel];
  return r ? { ...r.payload, updated_at: r.updated_at } : null;
}
/** 取 [fromIso, toIso] 区间内的要闻归档,返回 [{iso, channels:{launch,fin}}] */
export function headlinesInRange(fromIso, toIso) {
  const a = store.headlineArchive || {};
  return Object.keys(a).filter((k) => k >= fromIso && k <= toIso).sort()
    .map((iso) => ({ iso, channels: a[iso] }));
}

// 周报 / 月报:key 形如 W:2026-08-24(周一) 或 M:2026-08
export function saveReport(key, payload) {
  store.reports = store.reports || {};
  store.reports[key] = { payload, updated_at: new Date().toISOString() };
  persist();
}
export function getReport(key) {
  const r = store.reports && store.reports[key];
  return r ? { ...r.payload, updated_at: r.updated_at } : null;
}
export function listReports() {
  const r = store.reports || {};
  return Object.keys(r).sort().reverse().map((key) => ({
    key, kind: key.startsWith("W:") ? "weekly" : "monthly",
    title: r[key].payload?.title || key,
    range: r[key].payload?.range || "",
    updated_at: r[key].updated_at,
  }));
}

// 日报(按 iso 日期归档)
function pruneDigests() {
  const keys = Object.keys(store.digests).sort(); // 升序,旧的在前
  if (keys.length <= KEEP_DAYS) return 0;
  const drop = keys.slice(0, keys.length - KEEP_DAYS);
  for (const k of drop) delete store.digests[k];
  console.log(`[db] 日报归档裁剪:移除 ${drop.length} 天(保留最近 ${KEEP_DAYS} 天)`);
  return drop.length;
}
/**
 * 归档一天的日报。
 * @param {string} iso   日期
 * @param {object} payload 日报内容
 * @param {object} [meta]  { source: "daily" | "backfill" } —— 补漏生成的要和当天正常生成的区分开
 */
export function saveDigest(iso, payload, meta = {}) {
  const source = meta.source === "backfill" ? "backfill" : "daily";
  const rec = { payload, created_at: new Date().toISOString() };
  // 只有补漏才写 source 字段:当天正常生成的记录保持和历史数据完全一致的形状。
  if (source === "backfill") rec.source = "backfill";
  store.digests[iso] = rec;
  // 这一天补上了,把它此前的失败记录标记为已解决(保留痕迹,不删)
  const nowIso = new Date().toISOString();
  for (const f of store.digestFailures) if (f.iso === iso && !f.resolvedAt) f.resolvedAt = nowIso;
  pruneDigests();
  persist();
}
export function getDigest(iso) { return store.digests[iso]?.payload || null; }
export function listDigests() {
  return Object.keys(store.digests).sort().reverse()
    .map((iso) => ({
      iso,
      date: store.digests[iso].payload?.date || iso,
      // 老记录没有 source 字段,视作当天正常生成
      source: store.digests[iso].source || "daily",
    }));
}
/** 已归档的日期集合,供补漏检查缺口用。 */
export function digestIsoSet() { return new Set(Object.keys(store.digests)); }

// —— 日报生成失败留痕 ——
// 此前生成失败只在日志里留一行,Railway 日志滚动之后就查不到了,只能靠 /api/news/archive
// 反推哪天缺了、却不知道为什么缺。这里把失败落进 data.json,由 /api/health 暴露。

/** 记一次生成失败。同一天多次失败会各记一条(含第几次尝试)。 */
export function recordDigestFailure(iso, message, extra = {}) {
  store.digestFailures.push({
    iso,
    at: new Date().toISOString(),
    error: String(message || "未知错误").slice(0, 500),
    ...extra, // 常见:{ source: "daily" | "backfill", attempts: 3 }
  });
  if (store.digestFailures.length > FAILURE_KEEP) {
    store.digestFailures = store.digestFailures.slice(-FAILURE_KEEP);
  }
  persist();
}
/** 最近 n 条失败记录,最新的在前。 */
export function listDigestFailures(n = 10) {
  return store.digestFailures.slice(-Math.max(1, n)).reverse();
}

// 新闻 AI 摘要缓存(按 URL)。超出上限时丢弃最旧的,避免 data.json 无限增长。
const SUMMARY_MAX = Math.max(100, Number(process.env.SUMMARY_MAX || 800));
export function getSummary(url) {
  const r = (store.summaries || {})[url];
  return r || null;
}
export function saveSummary(url, payload) {
  store.summaries = store.summaries || {};
  store.summaries[url] = { ...payload, cachedAt: new Date().toISOString() };
  const keys = Object.keys(store.summaries);
  if (keys.length > SUMMARY_MAX) {
    keys.sort((a, b) => (store.summaries[a].cachedAt || "").localeCompare(store.summaries[b].cachedAt || ""));
    for (const k of keys.slice(0, keys.length - SUMMARY_MAX)) delete store.summaries[k];
  }
  persist();
}
