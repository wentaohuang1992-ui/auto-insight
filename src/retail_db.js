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

/* ---------------- 集团归属:把"厂商"归到车企集团 ----------------
   榜单给的是厂商(如 广汽丰田、腾势汽车),看走势要按集团合并。
   只列主要集团;没命中的厂商自成一档,不强行归类(宁可散着,也不要归错)。 */
const GROUPS = {
  "比亚迪": ["比亚迪", "腾势", "方程豹", "仰望"],
  "吉利集团": ["吉利", "领克", "极氪", "银河", "几何", "睿蓝"],
  "奇瑞集团": ["奇瑞", "星途", "捷途", "iCAR", "智界", "JAECOO", "欧萌达", "风云"],
  "长安集团": ["长安", "深蓝", "阿维塔", "启源", "凯程"],
  "长城汽车": ["长城", "哈弗", "魏牌", "WEY", "欧拉", "坦克", "长城皮卡"],
  "上汽集团": ["上汽", "荣威", "名爵", "MG", "智己", "飞凡", "五菱", "宝骏"],
  "广汽集团": ["广汽", "传祺", "埃安", "昊铂"],
  "东风集团": ["东风", "岚图", "奕派", "纳米", "猛士", "风神"],
  "赛力斯": ["赛力斯", "问界", "AITO"],
  "北汽集团": ["北汽", "极狐", "享界", "北京越野"],
  "一汽集团": ["一汽", "红旗", "奔腾"],
  "理想汽车": ["理想"],
  "蔚来": ["蔚来", "乐道", "firefly", "萤火虫"],
  "小鹏汽车": ["小鹏"],
  "零跑汽车": ["零跑"],
  "小米汽车": ["小米"],
  "特斯拉": ["特斯拉", "Tesla"],
  "大众系": ["大众", "奥迪", "斯柯达"],
  "丰田系": ["丰田", "雷克萨斯"],
  "本田系": ["本田"],
  "日产系": ["日产", "启辰", "英菲尼迪"],
  "宝马系": ["宝马", "MINI"],
  "奔驰系": ["奔驰", "smart"],
  "通用系": ["别克", "雪佛兰", "凯迪拉克"],
};
/** 厂商/品牌 → 集团;命中不了就返回原名(自成一档) */
export function groupOf(maker) {
  const m = String(maker || "").trim();
  if (!m) return "未知";
  for (const [g, keys] of Object.entries(GROUPS)) {
    if (keys.some((k) => m.includes(k))) return g;
  }
  return m;
}

/**
 * 按车企看:集团 → 厂商/品牌 → 车型 三层聚合。
 * 数据取车型榜(覆盖最全),厂商字段来自榜单本身。
 * 返回 [{group, total, share, makers:[{maker,total,models:[{name,sales,...}]}]}]
 */
export function byCompany(year, month, { source = null } = {}) {
  const db = load();
  const bucket = db.snapshots[key(year, month, "model")] || {};
  const srcs = source ? [source] : Object.keys(bucket);
  if (!srcs.length) return { year, month, groups: [], sources: [] };

  // 多源时以覆盖最全的那个为主表,其余仅用于对比(不合并,避免口径混算)
  const main = srcs.sort((a, b) => (bucket[b]?.items.length || 0) - (bucket[a]?.items.length || 0))[0];
  const items = (bucket[main] || {}).items || [];

  const gmap = new Map();
  for (const it of items) {
    const g = groupOf(it.maker), mk = it.maker || "其他";
    if (!gmap.has(g)) gmap.set(g, { group: g, total: 0, makers: new Map() });
    const G = gmap.get(g);
    G.total += it.sales || 0;
    if (!G.makers.has(mk)) G.makers.set(mk, { maker: mk, total: 0, models: [] });
    const M = G.makers.get(mk);
    M.total += it.sales || 0;
    // 其它来源对同一车型的数字,挂上去供核对
    const others = {};
    for (const s of srcs) {
      if (s === main) continue;
      const hit = (bucket[s].items || []).find((x) => normName(x.name) === normName(it.name));
      if (hit) others[s] = hit.sales;
    }
    M.models.push({ name: it.name, sales: it.sales, rank: it.rank, price: it.price || "", others });
  }

  const all = [...gmap.values()].map((G) => ({
    group: G.group, total: G.total,
    makers: [...G.makers.values()].map((M) => ({
      ...M, models: M.models.sort((a, b) => b.sales - a.sales),
    })).sort((a, b) => b.total - a.total),
  })).sort((a, b) => b.total - a.total);

  const sum = all.reduce((a, g) => a + g.total, 0) || 1;
  all.forEach((g) => { g.share = +(g.total / sum * 100).toFixed(1); });
  return { year, month, mainSource: main, sources: srcs, totalAll: sum, groups: all };
}

/** 某集团的逐月走势(依赖已抓过的月份快照) */
export function trendOf(group, { months = 12 } = {}) {
  const db = load();
  const keys = Object.keys(db.snapshots).filter((k) => k.endsWith("|model")).sort();
  const out = [];
  for (const k of keys.slice(-months)) {
    const [ym] = k.split("|"); const [y, m] = ym.split("-").map(Number);
    const bucket = db.snapshots[k];
    const main = Object.keys(bucket).sort((a, b) => bucket[b].items.length - bucket[a].items.length)[0];
    if (!main) continue;
    let total = 0, models = 0;
    for (const it of bucket[main].items) {
      if (groupOf(it.maker) !== group) continue;
      total += it.sales || 0; models++;
    }
    out.push({ year: y, month: m, total, models });
  }
  return out;
}
