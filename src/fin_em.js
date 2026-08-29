// 东方财富 F10 三大报表抓取 → 单季口径 → 季度表。
// 数据源即财报(交易所披露),补上 LLM 抓不到的存货/应付/经营现金流等细项。
// 仅适用 A 股(.SH/.SZ);港股/美股另走他源。利润表/现金流量表为累计→本模块换算为单季;资产负债表取期末。
import { listCompanies, getAll, upsertQuarterly, upsertStatement, slug } from "./fin_db.js";
import { fetchWithTimeout } from "./http.js";

// 旧 F10 ajax 端点(emweb .../NewFinanceAnalysis/*AjaxNew)已改返回 HTML(拦截页/失效),弃用。
// 改用东方财富数据中心 v1 接口(一手数据源地图里实测返回干净 JSON),字段名与下方 pick() 本就一致。
const DC = "https://datacenter.eastmoney.com/securities/api/data/v1/get";
const RPT = { lrbAjaxNew: "RPT_F10_FINANCE_GINCOME", zcfzbAjaxNew: "RPT_F10_FINANCE_GBALANCE", xjllbAjaxNew: "RPT_F10_FINANCE_GCASHFLOW" };
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://data.eastmoney.com/", "Accept": "application/json, text/plain, */*" };

// "601127.SH" / "600733.SH / 1958.HK" → "SH601127";无 A 股代码返回 null
export function pickAShare(ticker) {
  const m = String(ticker || "").match(/(\d{6})\.(SH|SZ)/i);
  return m ? m[2].toUpperCase() + m[1] : null;
}
function pick(obj, keys) { for (const k of keys) { const v = obj[k]; if (v != null && v !== "" && !isNaN(+v)) return +v; } return null; }
const YI = (v) => (v == null ? null : v / 1e8);                 // 元 → 亿元
function ymq(rd) { const m = String(rd || "").match(/(\d{4})-(\d{2})/); if (!m) return null; const q = { 3: 1, 6: 2, 9: 3, 12: 4 }[+m[2]]; return q ? { y: +m[1], q } : null; }

async function emGet(path, code) {
  // pickAShare 输出形如 SZ002594 → datacenter 需要 SECUCODE "002594.SZ"
  const m = String(code).match(/^(SH|SZ)(\d{6})$/i);
  const secucode = m ? `${m[2]}.${m[1].toUpperCase()}` : code;
  const reportName = RPT[path] || path;
  const params = new URLSearchParams({
    reportName, columns: "ALL", filter: `(SECUCODE="${secucode}")`,
    pageNumber: "1", pageSize: "20", sortTypes: "-1", sortColumns: "REPORT_DATE",
    source: "HSF10", client: "PC",
  });
  const r = await fetchWithTimeout(`${DC}?${params}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); }
  catch { throw new Error(`东方财富返回非 JSON(${path}),疑似拦截页/端点失效/IP 受限。前120字:${text.slice(0, 120).replace(/\s+/g, " ")}`); }
  const data = j?.result?.data || (Array.isArray(j) ? j : (j.data || (j.Result && j.Result.Data) || j.Data || []));
  return Array.isArray(data) ? data : [];
}

export async function buildQuartersEM(company) {
  const code = pickAShare(company.ticker);
  if (!code) throw new Error("非 A 股(无 .SH/.SZ 代码),东方财富 A 股源暂不适用:" + company.name);
  const [inc, bal, cf] = await Promise.all([emGet("lrbAjaxNew", code), emGet("zcfzbAjaxNew", code), emGet("xjllbAjaxNew", code)]);
  const sampleKeys = { income: Object.keys(inc[0] || {}), balance: Object.keys(bal[0] || {}), cash: Object.keys(cf[0] || {}) };

  const incCum = {}, cfCum = {}, balEnd = {};
  for (const r of inc) { const k = ymq(r.REPORT_DATE); if (!k) continue; (incCum[k.y] = incCum[k.y] || {})[k.q] = { rev: pick(r, ["OPERATE_INCOME", "TOTAL_OPERATE_INCOME"]), cost: pick(r, ["OPERATE_COST", "TOTAL_OPERATE_COST"]), rd: pick(r, ["RESEARCH_EXPENSE", "RD_EXPENSE", "MANAGE_EXPENSE_RD"]), np: pick(r, ["PARENT_NETPROFIT", "NETPROFIT"]) }; }
  for (const r of cf) { const k = ymq(r.REPORT_DATE); if (!k) continue; (cfCum[k.y] = cfCum[k.y] || {})[k.q] = { ocf: pick(r, ["NETCASH_OPERATE"]), fin: pick(r, ["NETCASH_FINANCE"]) }; }
  for (const r of bal) { const k = ymq(r.REPORT_DATE); if (!k) continue; (balEnd[k.y] = balEnd[k.y] || {})[k.q] = { inv: pick(r, ["INVENTORY"]), ap: pick(r, ["ACCOUNTS_PAYABLE", "NOTE_ACCOUNTS_PAYABLE"]), cash: pick(r, ["MONETARYFUNDS", "CURRENCY_FUNDS"]), st: pick(r, ["SHORT_LOAN", "SHORTTERM_LOAN"]), lt: pick(r, ["LONG_LOAN", "LONGTERM_LOAN"]), ar: pick(r, ["ACCOUNTS_RECE", "NOTE_ACCOUNTS_RECE"]), ta: pick(r, ["TOTAL_ASSETS"]), tl: pick(r, ["TOTAL_LIABILITIES"]) }; }

  // 累计 → 单季:Q1=累计;Q2..Q4 = 本期累计 − 上期累计(同年)
  const single = (cum, y, q, f) => { const cur = cum[y] && cum[y][q] ? cum[y][q][f] : null; if (cur == null) return null; if (q === 1) return cur; const prev = cum[y] && cum[y][q - 1] ? cum[y][q - 1][f] : null; return prev == null ? null : cur - prev; };

  // 保留非报表字段(销量/上险/库存系数/产成品/资本化率)——东方财富三大表没有
  const ex = {}; for (const x of getAll().quarterly) if (x.company === company.id) ex[x.year + "Q" + x.q] = x;
  const url = `https://emweb.securities.eastmoney.com/pc_hsf10/pages/index.html?type=web&code=${code}#/cwfx`;
  const src = [{ title: "东方财富 F10·财务报表", url }];

  const years = new Set([...Object.keys(incCum), ...Object.keys(balEnd), ...Object.keys(cfCum)].map(Number));
  const out = [];
  for (const y of years) for (let q = 1; q <= 4; q++) {
    const b = balEnd[y] && balEnd[y][q];
    const hasInc = incCum[y] && incCum[y][q];
    if (!b && !hasInc) continue;
    const e = ex[y + "Q" + q] || {};
    out.push({
      company: company.id, year: y, q,
      revenue: YI(single(incCum, y, q, "rev")), operatingCost: YI(single(incCum, y, q, "cost")),
      rdSpend: YI(single(incCum, y, q, "rd")), netProfit: YI(single(incCum, y, q, "np")),
      ocf: YI(single(cfCum, y, q, "ocf")), financingCF: YI(single(cfCum, y, q, "fin")),
      inventory: YI(b && b.inv), ap: YI(b && b.ap), cash: YI(b && b.cash), stDebt: YI(b && b.st),
      ltDebt: YI(b && b.lt), ar: YI(b && b.ar), totalAssets: YI(b && b.ta), totalLiab: YI(b && b.tl),
      sales: e.sales ?? null, retailReg: e.retailReg ?? null, dealerCoef: e.dealerCoef ?? null,
      invFinished: e.invFinished ?? null, invRaw: e.invRaw ?? null, rdCap: e.rdCap ?? null,
      // 三大报表里没有的新增字段,同样沿用库里已有值 —— 否则 cleanQ 会把它们清成 null
      netProfitEx: e.netProfitEx ?? null, govGrant: e.govGrant ?? null,
      jvIncome: e.jvIncome ?? null, overseasPct: e.overseasPct ?? null,
      sources: src,
    });
  }
  out.sort((a, b) => a.year - b.year || a.q - b.q);

  // —— 完整三表(as-reported):每个报告期存整行(数值列原样保留=元;前端按标准科目表展示并换算单位) ——
  // 不做累计→单季差分:财报三表本就按报告期(一季报/中报/三季报/年报)阅读,累计口径最faithful。
  const rowRaw = (r) => {
    const o = { REPORT_DATE: r.REPORT_DATE };
    // 存基础科目即可;跳过 _YOY 同比列、以及 SECURITY_CODE 等 *_CODE 数字型代码/元字段(它们能被 +v 解析成数,会污染科目)
    for (const k in r) { const v = r[k]; if (k !== "REPORT_DATE" && !k.endsWith("_YOY") && !/_CODE$/.test(k) && k !== "SECUCODE" && v != null && v !== "" && typeof v !== "boolean" && !isNaN(+v)) o[k] = +v; }
    return o;
  };
  const RT = { 1: "一季报", 2: "中报", 3: "三季报", 4: "年报" };
  const byDate = {};
  const idxStmt = (arr, kind) => { for (const r of arr) { const rd = r.REPORT_DATE; if (rd) (byDate[rd] = byDate[rd] || {})[kind] = rowRaw(r); } };
  idxStmt(inc, "income"); idxStmt(bal, "balance"); idxStmt(cf, "cashflow");
  const statements = Object.keys(byDate).map((rd) => {
    const k = ymq(rd); if (!k) return null;
    return { company: company.id, period: rd, year: k.y, q: k.q, reportType: RT[k.q], label: `${k.y}${RT[k.q]}`,
      income: byDate[rd].income || {}, balance: byDate[rd].balance || {}, cashflow: byDate[rd].cashflow || {}, sources: src };
  }).filter(Boolean).sort((a, b) => b.period.localeCompare(a.period));

  return { code, sampleKeys, counts: { income: inc.length, balance: bal.length, cash: cf.length }, quarters: out, statements };
}

export async function seedCompanyEM(idOrName, { save = true } = {}) {
  const c = listCompanies().find((x) => x.id === idOrName || x.id === slug(idOrName) || x.name === idOrName);
  if (!c) throw new Error("未找到车企:" + idOrName);
  const res = await buildQuartersEM(c);
  let saved = 0, savedStmt = 0;
  if (save) {
    for (const r of res.quarters) { const u = upsertQuarterly(r, { manual: false }); if (u.ok) saved++; }
    for (const s of res.statements) { const u = upsertStatement(s, { manual: false }); if (u && u.ok) savedStmt++; }
  }
  return { company: c.name, code: res.code, fetched: res.counts, quarters: res.quarters.length, saved, statements: res.statements.length, savedStmt, sampleKeys: res.sampleKeys, preview: res.quarters.slice(-4) };
}

// 全量(仅 A 股)——验证通过后再用
export async function seedAllEM() {
  const cs = listCompanies().filter((c) => pickAShare(c.ticker));
  let ok = 0, fail = 0;
  for (const c of cs) { try { await seedCompanyEM(c.name, { save: true }); ok++; } catch (e) { console.error("[em]", c.name, e.message); fail++; } }
  return { aShare: cs.length, ok, fail };
}
