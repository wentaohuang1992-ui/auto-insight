// 车企销量速递:多源并存 + 横向校验。
//
// 存储原则(与站内其它模块一致):
//   ① 每个来源各存各的,不做合并、不取平均 —— 合并会把口径差异抹掉,反而看不出问题;
//   ② 比对只做展示层的事:同名条目并排列出各源数字,差异超阈值标出来;
//   ③ 名称归一只用于"对齐同一款车",不改写原始名。
import { readStore, writeStore, resolveStorePath } from "./store.js";

const PATH = resolveStorePath("RETAIL_PATH", "retail.json");
const blank = () => ({ snapshots: {}, updatedAt: null });
const load = () => ({ ...blank(), ...readStore(PATH, blank) });
const save = (db) => { db.updatedAt = new Date().toISOString(); return writeStore(PATH, db); };

const key = (y, m, kind) => `${y}-${String(m).padStart(2, "0")}|${kind}`;

/** 存一份来源快照。同一 期间+榜单+来源 覆盖上一次。 */
export function saveSnapshot({ year, month, kind, source, items }) {
  if (!year || !month || !kind || !source) return { ok: false, error: "缺少 year/month/kind/source" };
  const db = load();
  const k = key(year, month, kind);
  db.snapshots[k] = db.snapshots[k] || {};
  db.snapshots[k][source] = {
    items: (items || []).map((x, i) => ({
      rank: x.rank ?? i + 1, name: String(x.name || "").trim(),
      sales: x.sales ?? null, maker: x.maker || "", price: x.price || "",
    })).filter((x) => x.name && x.sales != null),
    fetchedAt: new Date().toISOString(),
  };
  save(db);
  return { ok: true, key: k, source, count: db.snapshots[k][source].items.length };
}

/** 名称归一:仅用于对齐同款车,不改写原始名。去空格/括号注解/大小写差异。 */
export function normName(s) {
  return String(s || "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/新能源|纯电版|插电版|DM-i|EV$/gi, "")
    .replace(/[\s·・\-—_]+/g, "")
    .toLowerCase();
}

/**
 * 横向比对:把同一期间同一榜单下各来源的数据并排。
 * 返回 { sources[], rows[{name, maker, values{源:销量}, max, min, diffPct, flagged}] }
 * diffPct = (最大-最小)/最大;超过 threshold 标记 flagged。
 */
export function compare(year, month, kind, { threshold = 0.15, limit = 100 } = {}) {
  const db = load();
  const bucket = db.snapshots[key(year, month, kind)] || {};
  const sources = Object.keys(bucket);
  if (!sources.length) return { year, month, kind, sources: [], rows: [] };

  const merged = new Map();   // 归一名 → 行
  for (const src of sources) {
    for (const it of bucket[src].items) {
      const n = normName(it.name);
      if (!n) continue;
      if (!merged.has(n)) merged.set(n, { name: it.name, maker: it.maker || "", values: {}, ranks: {} });
      const row = merged.get(n);
      row.values[src] = it.sales;
      row.ranks[src] = it.rank;
      if (!row.maker && it.maker) row.maker = it.maker;
      // 展示名取最短的那个(通常是最规范的写法)
      if (it.name.length < row.name.length) row.name = it.name;
    }
  }

  const rows = [...merged.values()].map((r) => {
    const vals = Object.values(r.values).filter((v) => v != null);
    const max = Math.max(...vals), min = Math.min(...vals);
    const diffPct = (vals.length > 1 && max > 0) ? (max - min) / max : 0;
    return {
      ...r, max, min,
      covered: vals.length,                       // 有几个源收录了这一条
      diffPct: +(diffPct * 100).toFixed(1),
      flagged: vals.length > 1 && diffPct > threshold,   // 差异过大,值得人工看一眼
      onlyIn: vals.length === 1 ? Object.keys(r.values)[0] : null,
    };
  }).sort((a, b) => b.max - a.max).slice(0, limit);

  return {
    year, month, kind, sources,
    counts: Object.fromEntries(sources.map((s) => [s, bucket[s].items.length])),
    fetchedAt: Object.fromEntries(sources.map((s) => [s, bucket[s].fetchedAt])),
    rows,
    flaggedCount: rows.filter((r) => r.flagged).length,
  };
}

/** 有哪些期间/榜单已经抓过 */
export function listPeriods() {
  const db = load();
  return Object.keys(db.snapshots).sort().reverse().map((k) => {
    const [ym, kind] = k.split("|");
    const [y, m] = ym.split("-");
    return { year: +y, month: +m, kind, sources: Object.keys(db.snapshots[k]) };
  });
}
