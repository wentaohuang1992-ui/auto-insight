// 港股 F10 三大报表抓取 → 单季口径 → 季度表。是 fin_em.js 的港股孪生兄弟。
//
// 为什么需要它:fin_em.js 的 pickAShare 只认 .SH/.SZ,预置的 15 家里有 6 家没有 A 股代码
// ——奇瑞汽车(09973.HK,还是核心客户)、吉利汽车、理想汽车、零跑汽车、小鹏汽车、蔚来汽车。
// 这几家此前只能靠 DeepSeek 检索起草或手工录入,拿不到结构化报表。
//
// 与 fin_em.js 的三点不同:
//   1. 港股接口是**长表**(一行一个会计科目 ITEM_NAME/AMOUNT),不是宽表,要按科目名折叠;
//   2. 港股不强制季报。有的公司只有中报+年报(H1/FY),这时**差分不出单季**——
//      默认跳过而不是硬塞,要塞得显式传 halfYear:true,并且会在 note 里标明是半年口径;
//   3. 现金流量表的 reportName 没找到(试过 RPT_HKF10_FN_CASHFLOW / _CASHFLOWSHEET /
//      _CASHFLOWSTATEMENT 都返回「报表配置不存在」),所以 ocf/financingCF 目前为 null。
//      哪天找到了,设环境变量 HK_CASHFLOW_REPORT=<reportName> 就能自动接上,不用改代码。
//
// 数据源同为交易所披露的定期报告,东方财富只是把它结构化了。
import { listCompanies, getAll, upsertQuarterly, slug } from "./fin_db.js";
import { fetchWithTimeout } from "./http.js";
import { pickAShare } from "./fin_em.js";

const API = "https://datacenter.eastmoney.com/securities/api/data/v1/get";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://emweb.securities.eastmoney.com/" };
const CASHFLOW_REPORT = process.env.HK_CASHFLOW_REPORT || null;

/** "02015.HK / LI" / "600733.SH / 1958.HK" → "02015.HK";无港股代码返回 null。代码补足 5 位。 */
export function pickHK(ticker) {
  const m = String(ticker || "").match(/(\d{4,5})\.HK/i);
  return m ? m[1].padStart(5, "0") + ".HK" : null;
}

const YI = (v) => (v == null ? null : v / 1e8);          // 元 → 亿元
const NUM = (v) => (v == null || v === "" || isNaN(+v) ? null : +v);
function ymq(rd) { const m = String(rd || "").match(/(\d{4})-(\d{2})/); if (!m) return null; const q = { 3: 1, 6: 2, 9: 3, 12: 4 }[+m[2]]; return q ? { y: +m[1], q } : null; }

// —— 科目名映射。港股报表用的是香港会计准则的中文科目名,没有统一字段名,只能按名字认。 ——
// sum:true 表示同一字段可能由多个科目相加(应付帐款 + 应付票据)。
const INCOME_MAP = [
  ["revenue", /^(营业额|营运收入|收入|总收入|营业收入)$/],
  ["gross", /^毛利$/],
  ["operatingCost", /^(销售成本|营业成本)$/],
  ["netProfit", /^(股东应占溢利|本公司拥有人应占溢利|母公司拥有人应占溢利)$/],
  ["rdSpend", /^(研发费用|研究及开发费用|研发开支)$/],
  ["jvIncome", /^应占(合营|联营)公司(溢利|亏损)$/, { sum: true }],
];
const BALANCE_MAP = [
  ["inventory", /^存货$/],
  ["ap", /^(应付帐款|应付账款|应付票据)$/, { sum: true }],
  ["ar", /^(应收帐款|应收账款|应收票据)$/, { sum: true }],
  ["cash", /^(现金及等价物|现金及现金等价物|银行结存及现金)$/],
  ["stDebt", /^短期贷款$/],
  ["ltDebt", /^长期贷款$/],
  ["totalAssets", /^总资产$/],
  ["totalLiab", /^总负债$/],
];
const CASHFLOW_MAP = [
  ["ocf", /经营(活动|业务)(所得|产生|使用)?.*(现金|净额)/],
  ["financingCF", /融资(活动|业务).*(现金|净额)/],
];

async function emHK(reportName, secucode, pageSize = 400) {
  const q = new URLSearchParams({
    reportName, columns: "ALL", filter: `(SECUCODE="${secucode}")`,
    pageNumber: "1", pageSize: String(pageSize),
    sortTypes: "-1", sortColumns: "REPORT_DATE", source: "F10", client: "PC",
  });
  const url = `${API}?${q}`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${reportName} HTTP ${r.status}`);
  const j = await r.json();
  if (!j || j.success === false) throw new Error(`${reportName}:${(j && j.message) || "接口返回失败"}`);
  return Array.isArray(j.result?.data) ? j.result.data : [];
}

/** 长表 → { [year]: { [q]: {字段: 值} } };同时收集没认出来的科目名 */
function fold(rows, map) {
  const cum = {}, unmapped = new Set(), meta = {};
  for (const r of rows) {
    const k = ymq(r.REPORT_DATE);
    if (!k) continue;
    meta.currency = meta.currency || r.CURRENCY;
    meta.standard = meta.standard || r.ACCOUNT_STANDARD;
    meta.name = meta.name || r.SECURITY_NAME_ABBR;
    const name = String(r.ITEM_NAME || "").trim();
    const hit = map.find(([, re]) => re.test(name));
    if (!hit) { if (name) unmapped.add(name); continue; }
    const [field, , opt] = hit;
    const v = NUM(r.AMOUNT);
    if (v == null) continue;
    const slot = ((cum[k.y] = cum[k.y] || {})[k.q] = cum[k.y][k.q] || {});
    if (opt && opt.sum) slot[field] = (slot[field] || 0) + v;
    else if (slot[field] == null) slot[field] = v;
  }
  return { cum, unmapped: [...unmapped], meta };
}

export async function buildQuartersHK(company, { halfYear = false } = {}) {
  const code = pickHK(company.ticker);
  if (!code) throw new Error("没有港股代码(.HK),港股源不适用:" + company.name);

  const [incRows, balRows] = await Promise.all([
    emHK("RPT_HKF10_FN_INCOME", code),
    emHK("RPT_HKF10_FN_BALANCE", code),
  ]);
  let cfRows = [];
  if (CASHFLOW_REPORT) { try { cfRows = await emHK(CASHFLOW_REPORT, code); } catch (e) { console.error("[fin_hk] 现金流量表", e.message); } }

  const inc = fold(incRows, INCOME_MAP);
  const bal = fold(balRows, BALANCE_MAP);
  const cf = fold(cfRows, CASHFLOW_MAP);

  // 累计 → 单季:Q1 累计即单季;Q2..Q4 = 本期累计 − 上期累计(同年)。与 fin_em.js 同一套逻辑。
  const single = (cum, y, q, f) => {
    const cur = cum[y] && cum[y][q] ? cum[y][q][f] : null;
    if (cur == null) return null;
    if (q === 1) return cur;
    const prev = cum[y] && cum[y][q - 1] ? cum[y][q - 1][f] : null;
    return prev == null ? null : cur - prev;
  };
  // 港股常见:只有 H1(q=2) 与 FY(q=4),差分不出单季。halfYear 打开时按半年口径落库并标注。
  const halfSpan = (y, q) => (q === 2 && !(inc.cum[y] && inc.cum[y][1])) ||
                             (q === 4 && !(inc.cum[y] && inc.cum[y][3]));
  const flow = (cum, y, q, f) => {
    const v = single(cum, y, q, f);
    if (v != null) return v;
    if (!halfYear || !halfSpan(y, q)) return null;
    // 半年口径:q=2 直接用 H1 累计;q=4 用 FY − H1
    if (q === 2) return cum[y] && cum[y][2] ? cum[y][2][f] ?? null : null;
    if (q === 4) {
      const fy = cum[y] && cum[y][4] ? cum[y][4][f] : null;
      const h1 = cum[y] && cum[y][2] ? cum[y][2][f] : null;
      return fy == null || h1 == null ? null : fy - h1;
    }
    return null;
  };

  // 保留报表里没有的字段(销量/上险/库存系数/产成品/资本化率),与 fin_em.js 一致
  const ex = {};
  for (const x of getAll().quarterly) if (x.company === company.id) ex[x.year + "Q" + x.q] = x;

  const url = `https://emweb.securities.eastmoney.com/pc_hsf10/pages/index.html?type=hk&code=${code.replace(".HK", "")}#/NewFinancialAnalysis`;
  const src = [{ title: "东方财富 F10·港股财务报表", url }];

  const years = new Set([...Object.keys(inc.cum), ...Object.keys(bal.cum)].map(Number));
  const out = [];
  const skipped = [];
  for (const y of [...years].sort()) for (let q = 1; q <= 4; q++) {
    const b = bal.cum[y] && bal.cum[y][q];
    const hasInc = inc.cum[y] && inc.cum[y][q];
    if (!b && !hasInc) continue;

    const rev = flow(inc.cum, y, q, "revenue");
    const gross = flow(inc.cum, y, q, "gross");
    let cost = flow(inc.cum, y, q, "operatingCost");
    // 港股有的公司只披露毛利不披露销售成本,能反推就反推
    if (cost == null && rev != null && gross != null) cost = rev - gross;

    const isHalf = halfYear && halfSpan(y, q) && single(inc.cum, y, q, "revenue") == null;
    if (rev == null && !b) { skipped.push(`${y}Q${q}:缺上一期累计数,差分不出单季`); continue; }

    const e = ex[y + "Q" + q] || {};
    out.push({
      company: company.id, year: y, q,
      revenue: YI(rev), operatingCost: YI(cost),
      rdSpend: YI(flow(inc.cum, y, q, "rdSpend")),
      netProfit: YI(flow(inc.cum, y, q, "netProfit")),
      jvIncome: YI(flow(inc.cum, y, q, "jvIncome")),
      ocf: YI(flow(cf.cum, y, q, "ocf")),
      financingCF: YI(flow(cf.cum, y, q, "financingCF")),
      inventory: YI(b && b.inventory), ap: YI(b && b.ap), cash: YI(b && b.cash),
      stDebt: YI(b && b.stDebt), ltDebt: YI(b && b.ltDebt), ar: YI(b && b.ar),
      totalAssets: YI(b && b.totalAssets), totalLiab: YI(b && b.totalLiab),
      // 报表里没有的,沿用库里已有值,不清空
      sales: e.sales ?? null, retailReg: e.retailReg ?? null, dealerCoef: e.dealerCoef ?? null,
      invFinished: e.invFinished ?? null, invRaw: e.invRaw ?? null, rdCap: e.rdCap ?? null,
      sources: src,
      note: isHalf ? "⚠ 港股半年报口径:本条覆盖两个季度(该公司不披露季报),比率类指标可用,绝对值不要与单季公司横比" : "",
    });
  }
  out.sort((a, b) => a.year - b.year || a.q - b.q);

  return {
    code, quarters: out, skipped,
    meta: { ...inc.meta, aShareAlso: pickAShare(company.ticker) },
    counts: { income: incRows.length, balance: balRows.length, cash: cfRows.length },
    unmapped: { income: inc.unmapped, balance: bal.unmapped, cash: cf.unmapped },
    cashflowReport: CASHFLOW_REPORT || "(未配置 HK_CASHFLOW_REPORT,ocf/financingCF 为空)",
  };
}

export async function seedCompanyHK(idOrName, { save = true, halfYear = false } = {}) {
  const c = listCompanies().find((x) => x.id === idOrName || x.id === slug(idOrName) || x.name === idOrName);
  if (!c) throw new Error("未找到车企:" + idOrName);
  const res = await buildQuartersHK(c, { halfYear });
  const warn = [];
  if (res.meta.aShareAlso) {
    warn.push(`该车企同时有 A 股代码(${res.meta.aShareAlso})。A 股与港股上市主体不一定是同一个合并范围` +
      `(例如北汽:600733 北汽蓝谷 vs 1958 北京汽车),优先用「东方财富抓取(A股)」,除非你确认要的就是港股主体。`);
  }
  if (res.skipped.length) warn.push(`${res.skipped.length} 个期间差分不出单季已跳过(该公司可能只披露中报/年报;要按半年口径入库请带 halfYear)`);
  if (res.unmapped.income.length) warn.push(`利润表有 ${res.unmapped.income.length} 个科目未映射,如需要请补进 fin_hk.js 的 INCOME_MAP`);

  let saved = 0;
  if (save) for (const r of res.quarters) { const u = upsertQuarterly(r, { manual: false }); if (u.ok) saved++; }
  return {
    company: c.name, code: res.code, currency: res.meta.currency, standard: res.meta.standard,
    fetched: res.counts, quarters: res.quarters.length, saved, warn,
    skipped: res.skipped, unmapped: res.unmapped, cashflowReport: res.cashflowReport,
    preview: res.quarters.slice(-4),
  };
}

/** 全量:只跑没有 A 股代码的港股公司,避免和 fin_em 抢同一家 */
export async function seedAllHK({ halfYear = false } = {}) {
  const cs = listCompanies().filter((c) => pickHK(c.ticker) && !pickAShare(c.ticker));
  let ok = 0, fail = 0;
  const detail = [];
  for (const c of cs) {
    try { const r = await seedCompanyHK(c.name, { save: true, halfYear }); ok++; detail.push({ company: c.name, saved: r.saved, quarters: r.quarters }); }
    catch (e) { console.error("[hk]", c.name, e.message); fail++; detail.push({ company: c.name, error: e.message }); }
  }
  return { hkOnly: cs.length, ok, fail, detail };
}
