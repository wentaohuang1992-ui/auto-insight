// 一次性导入:把 seed/fin_import.json 灌进季度财务表。
//
// 这份种子来自另一条链路(交易所与监管接口直采 + 财经媒体交叉核对),补的是
// fin_em.js / fin_hk.js / fin_seed.js 拿不到或没拿全的东西:
//   · 季度销量 sales —— 单车指标的分母,三大报表里没有
//   · 扣非归母 / 政府补助 / 合联营投资收益 / 海外收入占比 四个新增可选字段
//   · 港股公司的历史季度(在 fin_hk.js 之前只能靠 LLM 起草)
//
// ⚠ 最重要的一条:**只填空,不覆盖**。
// upsertQuarterly 内部是 { ...旧记录, ...cleanQ(新记录) },而 cleanQ 会把没给的字段
// 一律写成 null —— 也就是说,拿一份稀疏的数据去 upsert,会把之前东方财富抓来的
// 存货/应付/总资产**清成空**。种子在资产负债表类字段上恰恰是稀疏的(存货 19%、应付 16%),
// 直接灌进去就是一次数据倒退。
// 所以这里先把库里已有记录读出来,逐字段做"旧值优先、旧值为空才用种子值"的合并,
// 再整条 upsert。要反过来以种子为准,显式传 overwriteExisting:true。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listCompanies, getAll, upsertQuarterly } from "./fin_db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = process.env.FIN_IMPORT_FILE || path.join(__dirname, "..", "seed", "fin_import.json");

// 参与合并的数值字段(与 fin_db.cleanQ 的键列表保持一致)
const FIELDS = ["revenue", "netProfit", "operatingCost", "inventory", "ap", "rdSpend",
  "ocf", "cash", "stDebt", "ltDebt", "ar", "financingCF", "totalAssets", "totalLiab",
  "invFinished", "invRaw", "dealerCoef", "rdCap", "sales", "retailReg",
  "netProfitEx", "govGrant", "jvIncome", "overseasPct"];

export function loadSeed() {
  if (!fs.existsSync(SEED)) throw new Error("找不到种子文件:" + SEED);
  const j = JSON.parse(fs.readFileSync(SEED, "utf8"));
  if (!Array.isArray(j.rows)) throw new Error("种子文件格式不对:缺 rows 数组");
  return j;
}

/** 旧值优先的合并;返回 { rec, filled: [被种子填上的字段名] } */
function merge(existing, seedRow, overwriteExisting) {
  const rec = { company: seedRow.company, year: seedRow.year, q: seedRow.q };
  const filled = [];
  for (const f of FIELDS) {
    const oldV = existing ? existing[f] : null;
    const newV = seedRow[f] == null ? null : seedRow[f];
    if (overwriteExisting) { rec[f] = newV != null ? newV : oldV ?? null; if (newV != null && newV !== oldV) filled.push(f); }
    else { rec[f] = oldV != null ? oldV : newV; if (oldV == null && newV != null) filled.push(f); }
  }
  // 出处合并去重,别把旧出处冲掉
  const olds = (existing && Array.isArray(existing.sources)) ? existing.sources : [];
  const news = Array.isArray(seedRow.sources) ? seedRow.sources : [];
  const seen = new Set();
  rec.sources = [...olds, ...news].filter((s) => s && s.url && !seen.has(s.url) && seen.add(s.url));
  const oldNote = (existing && existing.note) || "";
  rec.note = filled.length && seedRow.note && !oldNote.includes(seedRow.note)
    ? (oldNote ? oldNote + " | " : "") + seedRow.note
    : oldNote || seedRow.note || "";
  return { rec, filled };
}

/**
 * @param {boolean} opts.apply             true 才真正写库;默认 false(只出报告)
 * @param {string}  opts.company           只导入某一家(车企 id 或名称)
 * @param {boolean} opts.overwriteManual   覆盖手改记录,默认 false。**慎用。**
 * @param {boolean} opts.overwriteExisting 以种子为准覆盖已有数字,默认 false(只填空)
 */
export function importSeed({ apply = false, company = null, overwriteManual = false, overwriteExisting = false } = {}) {
  const seed = loadSeed();
  const known = new Map(listCompanies().map((c) => [c.id, c]));
  const existingMap = new Map(getAll().quarterly.map((q) => [q.id, q]));

  const match = (r) => !company || r.company === company || known.get(r.company)?.name === company;
  const plan = { willInsert: [], willFill: [], noChange: [], keepManual: [], unknownCompany: [] };
  const fieldFillCount = {};

  for (const r of seed.rows) {
    if (!match(r)) continue;
    if (!known.has(r.company)) { plan.unknownCompany.push(`${r.company} ${r.year}Q${r.q}`); continue; }
    const id = `${r.company}:${r.year}Q${r.q}`;
    const cur = existingMap.get(id);
    const tag = `${known.get(r.company).name} ${r.year}Q${r.q}`;
    if (cur && cur.manual && !overwriteManual) { plan.keepManual.push(tag); continue; }
    const { filled } = merge(cur, r, overwriteExisting);
    for (const f of filled) fieldFillCount[f] = (fieldFillCount[f] || 0) + 1;
    if (!cur) plan.willInsert.push(tag);
    else if (filled.length) plan.willFill.push(`${tag}（补 ${filled.join("/")}）`);
    else plan.noChange.push(tag);
  }

  const result = {
    seedFile: path.relative(process.cwd(), SEED),
    generatedAt: seed.generatedAt, origin: seed.origin, caliber: seed.caliber,
    mode: overwriteExisting ? "以种子为准覆盖已有数字" : "只填空,不覆盖已有数字(默认)",
    rowsInSeed: seed.rows.length,
    notMapped: seed.notMapped || {},
    skippedWhenGenerated: (seed.skipped || []).length,
    plan: {
      insert: plan.willInsert.length, fillGaps: plan.willFill.length,
      noChange: plan.noChange.length, keepManual: plan.keepManual.length,
      unknownCompany: plan.unknownCompany.length,
    },
    fieldsToFill: fieldFillCount,
    detail: plan,
    applied: false, saved: 0, skippedManual: 0,
  };
  if (!apply) {
    result.note = "这是预演(dry-run)。确认无误后带 apply:true 再调一次才会写库。";
    return result;
  }

  let saved = 0, skippedManual = 0;
  for (const r of seed.rows) {
    if (!match(r) || !known.has(r.company)) continue;
    const cur = existingMap.get(`${r.company}:${r.year}Q${r.q}`);
    if (cur && cur.manual && !overwriteManual) { skippedManual++; continue; }
    const { rec } = merge(cur, r, overwriteExisting);
    const u = upsertQuarterly(rec, { manual: overwriteManual });
    if (u.ok) saved++; else if (u.skipped === "manual") skippedManual++;
  }
  result.applied = true;
  result.saved = saved;
  result.skippedManual = skippedManual;
  result.note = (skippedManual ? `${skippedManual} 条因为你手改过(manual:true)没有动。` : "") +
    "本次为合并写入:库里已有的数字一个都没被覆盖,只填了空位。";
  return result;
}

// ---------------------------------------------------------------------
// 覆盖率体检:哪家、哪个字段还是空的,以及该用哪个源去补
// ---------------------------------------------------------------------
const CORE = [
  ["revenue", "营业收入"], ["operatingCost", "营业成本"], ["netProfit", "归母净利"],
  ["rdSpend", "研发费用"], ["ocf", "经营现金流"], ["inventory", "存货"],
  ["ap", "应付账款及票据"], ["cash", "货币资金"], ["stDebt", "短期借款"],
  ["ltDebt", "长期借款"], ["totalAssets", "总资产"], ["totalLiab", "总负债"],
  ["sales", "季度销量"], ["netProfitEx", "扣非归母"], ["jvIncome", "合联营投资收益"],
];

export function coverage({ minYear = 2025 } = {}) {
  const companies = listCompanies();
  const all = getAll().quarterly.filter((q) => q.year >= minYear);
  const byCompany = {};
  for (const q of all) (byCompany[q.company] ||= []).push(q);

  const rows = companies.map((c) => {
    const qs = byCompany[c.id] || [];
    const isA = /(\d{6})\.(SH|SZ)/i.test(c.ticker);
    const isHK = /(\d{4,5})\.HK/i.test(c.ticker);
    const fields = {};
    for (const [f, label] of CORE) {
      const n = qs.filter((q) => q[f] != null).length;
      fields[label] = qs.length ? `${n}/${qs.length}` : "—";
    }
    const missing = CORE.filter(([f]) => qs.length && qs.filter((q) => q[f] != null).length === 0).map(([, l]) => l);
    const advice = [];
    if (!qs.length) advice.push(isA ? "整家没有数据 → 先点「东方财富抓取(A股)」" : isHK ? "整家没有数据 → 先点「港股抓取」" : "无 A 股/港股代码 → 只能 AI 抓取或手工录入");
    else {
      if (isA && missing.length) advice.push("跑一次「东方财富抓取(A股)」能补齐三大报表类字段");
      if (!isA && isHK) {
        if (missing.includes("经营现金流")) advice.push("港股源目前拿不到现金流量表(reportName 未知),需手工或另找源");
        if (missing.filter((m) => m !== "经营现金流").length) advice.push("跑一次「港股抓取」");
      }
      if (missing.includes("季度销量")) advice.push("季度销量报表里没有,要么导入种子,要么手工录");
    }
    return {
      company: c.name, id: c.id, type: c.type, listing: c.listing,
      source: isA ? "A股(东方财富)" : isHK ? "港股(东方财富)" : "无结构化源",
      quarters: qs.length, fields, missingAll: missing, advice,
    };
  });

  const totalCells = rows.reduce((s, r) => s + r.quarters * CORE.length, 0);
  const filledCells = rows.reduce((s, r) =>
    s + Object.values(r.fields).reduce((t, v) => t + (v === "—" ? 0 : Number(String(v).split("/")[0])), 0), 0);

  return {
    since: minYear,
    overallFillPct: totalCells ? Number((filledCells / totalCells * 100).toFixed(1)) : 0,
    companiesWithNoData: rows.filter((r) => !r.quarters).map((r) => r.company),
    rows: rows.sort((a, b) => b.quarters - a.quarters),
    legend: "fields 里是「有值期数/总期数」。advice 是补齐的最快路径。",
  };
}
