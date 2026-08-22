// 车型库种子:逐品牌检索(博查+Google)→ 规范化车型记录 → upsert 入库。
import { LEAVES } from "./cadence.js";
import { research } from "./research.js";
import { upsertModel, dbMeta } from "./models_db.js";
import { pool } from "./pool.js";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

function seedSchema(who) {
  return `请据资料整理【${who}】(含全部子品牌)**当前在售 + 2026 将上市**的全部车型(产品谱系),尽量列全、含季度级时间、确无依据不编造。每款车给:
- model 车型名;body 车身(轿车/SUV/MPV,轿跑/旅行归轿车、皮卡归SUV);
- priceFrom 起售价(纯数字,单位万,如 25.98;未知留 null);priceRange 价格区间字符串(如 "25.98-32.98万");
- adas 智驾系统(如 "华为乾崑ADS"、"自研XNGP"、"Momenta" 等;未知留空);hi 是否搭载华为乾崑(华为ADS/HI模式/鸿蒙智行)true或false;
- status 状态(在售/预售/即将上市/规划);
- launches 2026 年的上市计划数组,每项 {kind:"新车"或"改款", month:1到12数字, date:"如3月或预计Q3", estimated:true或false, note:"亮点30字内"};当年无新动作则空数组 [];
- note 一句话简介(40字内);
- sources 1-2 个**真实来源**(取自下方资料里实际出现的链接),格式 [{title,url}];没有就空数组。
JSON:{"models":[{"model":"","body":"","priceFrom":0,"priceRange":"","adas":"","hi":false,"status":"在售","launches":[{"kind":"新车","month":3,"date":"3月","estimated":false,"note":""}],"note":"","sources":[{"title":"","url":""}]}]}`;
}

export async function seedLeaf(leaf) {
  const q = [...leaf.q, `${leaf.brand} 在售车型 全部 价格 轿车 SUV MPV`];
  const gn = [`${leaf.brand} 2026 新车 改款 上市 规划`];
  const d = await research({ queries: q, schema: seedSchema(leaf.brand), freshness: "noLimit", count: 10, summaryLen: 600, maxTokens: 5000, model: MODEL, gnewsQueries: gn, gnewsWhen: "" });
  const models = Array.isArray(d.models) ? d.models : [];
  for (const m of models) {
    if (!m || !m.model) continue;
    upsertModel({
      brand: leaf.brand, group: leaf.group || "",
      model: m.model, body: m.body, priceFrom: typeof m.priceFrom === "number" ? m.priceFrom : (parseFloat(m.priceFrom) || null),
      priceRange: m.priceRange, adas: m.adas, hi: !!m.hi, status: m.status,
      launches: (Array.isArray(m.launches) ? m.launches : []).map((x) => ({ kind: x.kind || "新车", year: 2026, month: x.month || null, date: x.date || "", estimated: !!x.estimated, note: x.note || "" })),
      note: m.note, sources: Array.isArray(m.sources) ? m.sources.filter((s) => s && s.url).slice(0, 3) : []
    });
  }
  return models.length;
}

const ALL_LEAVES = () => [...LEAVES.yinwang, ...LEAVES.xinshili, ...LEAVES.chuantong].filter((l) => l.brand);

export async function seedModels() {
  await pool(ALL_LEAVES(), 4, async (leaf) => {
    try { const n = await seedLeaf(leaf); console.log("[seed]", leaf.brand, "->", n, "款"); }
    catch (e) { console.error("[seed]", leaf.brand, e.message); }
  });
  return dbMeta();
}

export async function seedOneBrand(brand) {
  let leaf = ALL_LEAVES().find((l) => l.brand === brand);
  if (!leaf) leaf = { brand, group: "", q: [`${brand} 在售车型 价格 轿车 SUV MPV`, `${brand} 2026 新车 改款 上市 规划`] };
  const n = await seedLeaf(leaf);
  console.log("[seed-brand]", brand, "->", n, "款");
  return { brand, count: n, ...dbMeta() };
}
