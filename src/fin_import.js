// 一次性导入:把 seed/fin_import.json 灌进季度财务表。
//
// 这份种子来自另一条链路(交易所与监管接口直采 + 财经媒体交叉核对),补的是
// fin_em.js / fin_seed.js 拿不到或没拿全的东西:
//   · 港股公司的历史季度(fin_em 只认 A 股)
//   · 季度销量 sales —— 单车指标的分母,三大报表里没有
//   · 扣非归母 / 政府补助 / 合联营投资收益 / 海外收入占比 四个新增可选字段
//
// 三条纪律:
//   1. 一律以 manual:false 入库 —— upsertQuarterly 会自动跳过你手改过的记录(manual:true),
//      导入不会覆盖人工核对过的数字;
//   2. 每条都带 sources(可点回原始出处);业绩预告口径的会在 note 里标明「非正式报表」;
//   3. 默认 dry-run,不加 apply 只出报告,先看清楚要写什么再决定。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listCompanies, getAll, upsertQuarterly } from "./fin_db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = process.env.FIN_IMPORT_FILE || path.join(__dirname, "..", "seed", "fin_import.json");

export function loadSeed() {
  if (!fs.existsSync(SEED)) throw new Error("找不到种子文件:" + SEED);
  const j = JSON.parse(fs.readFileSync(SEED, "utf8"));
  if (!Array.isArray(j.rows)) throw new Error("种子文件格式不对:缺 rows 数组");
  return j;
}

/**
 * @param {object} opts
 * @param {boolean} opts.apply   true 才真正写库;默认 false(只出报告)
 * @param {string}  opts.company 只导入某一家(车企 id 或名称)
 * @param {boolean} opts.overwriteManual 强行覆盖手改记录,默认 false。**慎用。**
 */
export function importSeed({ apply = false, company = null, overwriteManual = false } = {}) {
  const seed = loadSeed();
  const known = new Map(listCompanies().map((c) => [c.id, c]));
  const existing = new Map(getAll().quarterly.map((q) => [q.id, q]));

  const plan = { willInsert: [], willUpdate: [], keepManual: [], unknownCompany: [], sample: [] };

  for (const r of seed.rows) {
    if (company && r.company !== company && known.get(r.company)?.name !== company) continue;
    if (!known.has(r.company)) { plan.unknownCompany.push(`${r.company} ${r.year}Q${r.q}`); continue; }
    const id = `${r.company}:${r.year}Q${r.q}`;
    const cur = existing.get(id);
    const tag = `${known.get(r.company).name} ${r.year}Q${r.q}`;
    if (!cur) plan.willInsert.push(tag);
    else if (cur.manual && !overwriteManual) plan.keepManual.push(tag);
    else plan.willUpdate.push(tag);
  }
  plan.sample = seed.rows.slice(0, 3);

  const result = {
    seedFile: path.relative(process.cwd(), SEED),
    generatedAt: seed.generatedAt, origin: seed.origin, caliber: seed.caliber,
    rowsInSeed: seed.rows.length,
    notMapped: seed.notMapped || {},
    skippedWhenGenerated: (seed.skipped || []).length,
    plan: {
      insert: plan.willInsert.length, update: plan.willUpdate.length,
      keepManual: plan.keepManual.length, unknownCompany: plan.unknownCompany.length,
    },
    detail: plan,
    applied: false, saved: 0, skippedManual: 0,
  };
  if (!apply) {
    result.note = "这是预演(dry-run)。确认无误后带 apply:true 再调一次才会写库。";
    return result;
  }

  let saved = 0, skippedManual = 0;
  for (const r of seed.rows) {
    if (company && r.company !== company && known.get(r.company)?.name !== company) continue;
    if (!known.has(r.company)) continue;
    const { _confidence, ...rec } = r;
    const u = upsertQuarterly(rec, { manual: overwriteManual });
    if (u.ok) saved++; else if (u.skipped === "manual") skippedManual++;
  }
  result.applied = true;
  result.saved = saved;
  result.skippedManual = skippedManual;
  result.note = skippedManual
    ? `${skippedManual} 条因为你手改过(manual:true)没有覆盖。要强行覆盖请带 overwriteManual:true。`
    : "全部写入完成。";
  return result;
}
