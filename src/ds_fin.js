// 智驾/座舱供应商的财务自动抓取:直接复用车企财务模块的东方财富 A股/港股取数逻辑。
// 与车企模块一致的三条纪律:① 一律 manual:false 入库(不覆盖你手改过的记录);
// ② 毛利率由营收与营业成本派生,拿不到就留空不猜;③ 出货量报表里没有,仍需手工或另行来源。
import { buildQuartersEM, pickAShare } from "./fin_em.js";
import { buildQuartersHK, pickHK } from "./fin_hk.js";
import { fetchWithTimeout } from "./http.js";
import * as dsdb from "./ds_db.js";

// —— 美股:SEC EDGAR XBRL(companyconcept)。返回的是公司报给监管机构的结构化事实本身。 ——
// ticker → CIK 需要 CIK 号;这里维护一张小表,新增美股公司时补一行即可。
const CIK = { VC: "0001111335" };   // Visteon
const SEC_UA = process.env.SEC_UA || "auto-insight contact@example.com";

async function secConcept(cik, tag) {
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`;
  const r = await fetchWithTimeout(url, { headers: { "User-Agent": SEC_UA, Accept: "application/json" } }, 25000);
  if (!r.ok) return [];
  const j = await r.json();
  const out = [];
  for (const unit of Object.values(j.units || {})) {
    for (const it of unit) {
      if (!it.end || it.val == null) continue;
      // 只取单季(约 90 天)的区间,年报/半年累计跳过
      if (it.start) {
        const days = (new Date(it.end) - new Date(it.start)) / 864e5;
        if (days > 100) continue;
      }
      out.push({ end: it.end, val: it.val, filed: it.filed, fy: it.fy, fp: it.fp });
    }
  }
  // 同一期间多份申报(原报+重述)取 filed 最新的
  const best = new Map();
  for (const x of out) { const p = best.get(x.end); if (!p || (x.filed || "") > (p.filed || "")) best.set(x.end, x); }
  return [...best.values()].sort((a, b) => b.end.localeCompare(a.end));
}

/** 美股季度序列。金额单位:美元 → 换算成「亿元」口径需要汇率,这里直接给「亿美元」并在 note 标明。 */
async function buildQuartersUS(ticker) {
  const cik = CIK[String(ticker).toUpperCase()];
  if (!cik) throw new Error(`未维护该美股代码的 CIK:${ticker}(在 ds_fin.js 的 CIK 表补一行即可)`);
  const [rev, cost, ni, rd] = await Promise.all([
    secConcept(cik, "RevenueFromContractWithCustomerExcludingAssessedTax"),
    secConcept(cik, "CostOfGoodsAndServicesSold"),
    secConcept(cik, "NetIncomeLoss"),
    secConcept(cik, "ResearchAndDevelopmentExpense"),
  ]);
  const byEnd = {};
  const put = (arr, key) => arr.forEach((x) => { (byEnd[x.end] = byEnd[x.end] || {})[key] = x.val; });
  put(rev, "rev"); put(cost, "cost"); put(ni, "np"); put(rd, "rd");
  const YI = (v) => (v == null ? null : +(v / 1e8).toFixed(4));   // 美元 → 亿美元
  return Object.entries(byEnd).map(([end, v]) => {
    const m = end.match(/(\d{4})-(\d{2})/); if (!m) return null;
    const q = Math.ceil(+m[2] / 3);
    return { year: +m[1], q, revenue: YI(v.rev), operatingCost: YI(v.cost), netProfit: YI(v.np), rdSpend: YI(v.rd), currency: "USD" };
  }).filter(Boolean).sort((a, b) => (b.year - a.year) || (b.q - a.q));
}

/** 从 listed 字段里取出可用的证券代码。支持 "002920.SZ"、"09660.HK"、"2409.TW / 3481.TW"、"VC(纳斯达克)" 等写法。 */
export function pickTicker(listed) {
  const t = String(listed || "").toUpperCase();
  const a = t.match(/\d{6}\.(SH|SZ)/);
  if (a) return { kind: "A", ticker: a[0] };
  const h = t.match(/\d{4,5}\.HK/);
  if (h) return { kind: "HK", ticker: h[0].padStart(8, "0").slice(-8) };
  // 美股:形如 "VC(纳斯达克)" / "VC" —— 取交易代码,需在 CIK 表里维护
  const u = t.match(/\b([A-Z]{1,5})\b(?=\s*[（(]|$)/);
  if (u && CIK[u[1]]) return { kind: "US", ticker: u[1] };
  return null;   // 未上市 / 中国台湾 / 未维护CIK的美股 → 本源不适用
}

/** 抓一家供应商。vendor 来自 ds_db 的 adas/cockpit 列表。 */
export async function fetchVendorQuarters(vendor, kind, { save = true, limit = 8 } = {}) {
  const p = pickTicker(vendor.listed);
  if (!p) return { ok: false, name: vendor.name, warn: `无 A股/港股代码,自动抓取不适用(${vendor.listed || "未上市"})` };
  // 复用车企模块:两个 build 函数只认 {name, ticker} 这两个字段
  const shim = { name: vendor.name, ticker: p.ticker };
  let rows;
  const withTimeout = (pr, ms, label) => Promise.race([
    pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} 超时(${ms / 1000}s)`)), ms)),
  ]);
  try {
    const task = p.kind === "A" ? buildQuartersEM(shim)
      : p.kind === "US" ? buildQuartersUS(p.ticker)
      : buildQuartersHK(shim, { halfYear: true });
    rows = await withTimeout(task, 60000, vendor.name);   // 单家最多 60 秒,防止一家挂起拖死整轮
  } catch (e) {
    return { ok: false, name: vendor.name, warn: e.message };
  }
  const list = (rows && (rows.quarters || rows.rows || rows)) || [];
  const arr = Array.isArray(list) ? list : [];
  let saved = 0, skippedManual = 0;
  const out = [];
  for (const r of arr.slice(0, limit)) {
    // 毛利率派生:(营收-营业成本)/营收;任一缺失就留空,不猜
    const gm = (r.revenue && r.operatingCost != null && r.revenue !== 0)
      ? +(((r.revenue - r.operatingCost) / r.revenue) * 100).toFixed(2) : null;
    const rec = {
      vendorId: vendor.id, kind, year: r.year, q: r.q,
      // 与车企模块同名同义的全部科目,抓到什么存什么
      revenue: r.revenue ?? null, operatingCost: r.operatingCost ?? null, grossMargin: gm,
      netProfit: r.netProfit ?? null, netProfitEx: r.netProfitEx ?? null, rdSpend: r.rdSpend ?? null,
      ocf: r.ocf ?? null, financingCF: r.financingCF ?? null,
      inventory: r.inventory ?? null, ap: r.ap ?? null, ar: r.ar ?? null, cash: r.cash ?? null,
      stDebt: r.stDebt ?? null, ltDebt: r.ltDebt ?? null,
      totalAssets: r.totalAssets ?? null, totalLiab: r.totalLiab ?? null,
      govGrant: r.govGrant ?? null, overseasPct: r.overseasPct ?? null,
      currency: r.currency || "CNY",
      note: `自动抓取(${p.kind === "A" ? "东方财富A股" : p.kind === "HK" ? "东方财富港股" : "SEC EDGAR"})${r.currency === "USD" ? " · 单位:亿美元" : ""}`,
      sources: [{ title: p.kind === "US" ? "SEC EDGAR XBRL" : (p.kind === "A" ? "东方财富 财务数据" : "东方财富 港股F10"), url: "" }],
    };
    if (rec.revenue == null && rec.netProfit == null) continue;   // 整条空的不入库
    const res = dsdb.upsertVendorQuarter(rec, { manual: false });
    if (res.ok) { saved++; out.push(`${r.year}Q${r.q}`); }
    else if (res.skipped === "manual") skippedManual++;
  }
  return { ok: true, name: vendor.name, market: p.kind, ticker: p.ticker, saved, skippedManual, periods: out };
}

/** 全量抓取:两个板块所有有 A股/港股代码的供应商。串行,避免打爆上游。 */
export async function fetchAllVendors({ onProgress, deadlineMs = 8 * 60 * 1000 } = {}) {
  const all = dsdb.getAll();
  const jobs = [
    ...(all.adas || []).map((v) => [v, "adas"]),
    ...(all.cockpit || []).map((v) => [v, "cockpit"]),
  ].filter(([v]) => pickTicker(v.listed));   // 未上市/中国台湾的直接跳过,不浪费时间
  const results = [];
  const t0 = Date.now();
  let stoppedBy = null;
  for (let i = 0; i < jobs.length; i++) {
    if (Date.now() - t0 > deadlineMs) { stoppedBy = "超过整体时限,剩余未抓"; break; }
    const [v, kind] = jobs[i];
    if (onProgress) onProgress({ done: i, total: jobs.length, current: v.name });
    try { results.push(await fetchVendorQuarters(v, kind)); }
    catch (e) { results.push({ ok: false, name: v.name, warn: e.message }); }
  }
  const okN = results.filter((x) => x.ok).length;
  const savedN = results.reduce((a, x) => a + (x.saved || 0), 0);
  return { total: jobs.length, done: results.length, fetched: okN, saved: savedN, stoppedBy, results };
}
