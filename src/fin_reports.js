// 财报原文 PDF 链接抓取:按公司 + 报告期,从巨潮(A股)、港交所披露易(港股)取
// 年报 / 半年报的官方 PDF 链接。只取链接、不下载、不解析、不镜像 —— 零存储。
//
// 数据源与参数来自 docs/一手数据源地图.md(那里逐个真实请求验证过):
//   A股:巨潮 cninfo —— 先用股票表拿 orgId,再 POST hisAnnouncement/query 检索公告,
//        PDF 地址 = http://static.cninfo.com.cn/ + 返回项的 adjunctUrl。
//   港股:港交所披露易 —— 先 prefix.do 拿内部 stockId(不是股票代码),再 titleSearchServlet 检索,
//        PDF 地址 = https://www1.hkexnews.hk + 返回项的 FILE_LINK。
//
// ⚠ 我(写这段的沙箱)出网白名单连不到巨潮/港交所,以下按文档参数写、响应解析做了兜底,
//   真实字段以 scripts/probe_reports.mjs 的输出为准,对不上就照探针改这里的字段名(就几行)。
import { fetchWithTimeout } from "./http.js";

const UA = { "User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*" };

// ---------------------------------------------------------------------
// A 股:巨潮 cninfo
// ---------------------------------------------------------------------
const CNINFO = "http://www.cninfo.com.cn";
const CNINFO_STATIC = "http://static.cninfo.com.cn/";
// 公告分类:年报 / 半年报(见一手数据源地图的分类代码表)
// 从公告标题解析报告期,用于结构化归位。返回 {year, period, label, sort}
// period: FY 年报 / H1 半年报 / Q1 一季报 / Q3 三季报
export function parsePeriod(title, kind, date) {
  const t = String(title || "");
  const y = (t.match(/(20\d{2})\s*年/) || [])[1];
  let period = { 年报: "FY", 半年报: "H1", 一季报: "Q1", 三季报: "Q3" }[kind] || "";
  if (!period) {
    if (/年度报告/.test(t)) period = "FY";
    else if (/半年度报告/.test(t)) period = "H1";
    else if (/第一季度/.test(t)) period = "Q1";
    else if (/第三季度/.test(t)) period = "Q3";
  }
  // 年份兜底:季报/年报通常在次年披露,用公告日期回推
  let year = y ? Number(y) : (date ? Number(date.slice(0, 4)) : 0);
  if (!y && date) { const m = Number(date.slice(5, 7)); if (period === "FY" && m <= 6) year -= 1; }
  const ord = { Q1: 1, H1: 2, Q3: 3, FY: 4 }[period] || 0;
  const label = { FY: "年报", H1: "半年报", Q1: "一季报", Q3: "三季报" }[period] || kind || "公告";
  return { year, period, label, sort: year * 10 + ord };
}

// 摘要/英文/更正/取消等不是报告正文
const NOISE_RE = /摘要|英文|English|更正|补充|已取消|催告|问询|说明公告|风险提示/i;

const CN_CATEGORY = {
  年报: "category_ndbg_szsh", 半年报: "category_bndbg_szsh",
  一季报: "category_yjdbg_szsh", 三季报: "category_sjdbg_szsh",
};

let _orgCache = null; // { "000001": "gssz0000001", ... }

/** 拉深交所+上交所股票表,建 code→orgId 映射(巨潮检索必须带 orgId)。缓存一次。 */
export async function loadOrgMap() {
  if (_orgCache) return _orgCache;
  const map = {};
  for (const url of [`${CNINFO}/new/data/szse_stock.json`, `${CNINFO}/new/data/sse_stock.json`]) {
    try {
      const r = await fetchWithTimeout(url, { headers: UA }, 20000);
      const j = JSON.parse(await r.text());
      for (const s of j.stockList || []) if (s.code && s.orgId) map[s.code] = s.orgId;
    } catch (e) { console.error("[fin_reports] 股票表:", url, e.message); }
  }
  _orgCache = map;
  return map;
}

/** 取某 A 股公司的年报/半年报 PDF 链接。code 形如 002594.SZ / 601127.SH。 */
export async function aShareReports(codeWithSuffix, { kinds = ["年报", "半年报", "一季报", "三季报"], pageSize = 12 } = {}) {
  const [code, suffix] = codeWithSuffix.split(".");
  const column = suffix === "SH" ? "sse" : "szse"; // 上交所 sse / 深交所 szse
  const orgId = (await loadOrgMap())[code];
  if (!orgId) return { links: [], warn: `巨潮股票表里没找到 ${code} 的 orgId` };
  const links = [];
  for (const kind of kinds) {
    const category = CN_CATEGORY[kind];
    if (!category) continue;
    try {
      const body = new URLSearchParams({
        pageNum: "1", pageSize: String(pageSize), column, tabName: "fulltext",
        stock: `${code},${orgId}`, category, isHLtitle: "true",
      });
      const r = await fetchWithTimeout(`${CNINFO}/new/hisAnnouncement/query`, {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }, 20000);
      const j = JSON.parse(await r.text());
      for (const a of j.announcements || []) {
        if (!a.adjunctUrl) continue;
        const title = (a.announcementTitle || "").replace(/<[^>]+>/g, "");
        if (NOISE_RE.test(title)) continue;
        const date = a.announcementTime ? new Date(+a.announcementTime).toISOString().slice(0, 10) : "";
        links.push({ market: "A股", kind, title, date, url: CNINFO_STATIC + a.adjunctUrl, ...parsePeriod(title, kind, date) });
      }
    } catch (e) { console.error("[fin_reports] 巨潮检索", code, kind, e.message); }
  }
  return { links };
}

// ---------------------------------------------------------------------
// 港股:港交所披露易 HKEXnews
// ---------------------------------------------------------------------
const HKEX = "https://www1.hkexnews.hk";
// t2code:年报 40100 / 中期报告 40200(见一手数据源地图)
const HK_T2 = { 年报: "40100", 半年报: "40200", 季报: "40300" };

/** 港股代码(如 00175.HK)→ 披露易内部 stockId。prefix.do 返回 JSONP 包裹,需剥回调。 */
export async function hkStockId(codeWithSuffix) {
  const code = codeWithSuffix.split(".")[0];
  const r = await fetchWithTimeout(
    `${HKEX}/search/prefix.do?callback=cb&lang=ZH&type=A&name=${code}&market=SEHK`,
    { headers: UA }, 20000
  );
  const txt = await r.text();
  const m = txt.match(/\{[\s\S]*\}/); // 从 cb({...}) 里抠 JSON
  if (!m) return null;
  const j = JSON.parse(m[0]);
  const hit = (j.stockInfo || []).find((s) => String(s.code).padStart(5, "0") === code.padStart(5, "0")) || (j.stockInfo || [])[0];
  return hit ? hit.stockId : null;
}

export async function hkReports(codeWithSuffix, { kinds = ["年报", "半年报", "季报"], from = "20220101", to } = {}) {
  const toDate = to || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const stockId = await hkStockId(codeWithSuffix);
  if (!stockId) return { links: [], warn: `披露易没解析到 ${codeWithSuffix} 的 stockId` };
  const links = [];
  for (const kind of kinds) {
    const t2 = HK_T2[kind];
    try {
      const q = new URLSearchParams({
        sortDir: "0", sortByOptions: "DateTime", category: "0", market: "SEHK",
        stockId: String(stockId), documentType: "-1", fromDate: from, toDate,
        searchType: "1", t1code: "40000", t2Gcode: "-2", t2code: t2, rowRange: "50", lang: "ZH",
      });
      const r = await fetchWithTimeout(`${HKEX}/search/titleSearchServlet.do?${q}`, { headers: UA }, 20000);
      const txt = await r.text();
      const j = JSON.parse(txt.replace(/^[^{[]*/, "")); // 去掉可能的前缀
      const rows = j.result ? (typeof j.result === "string" ? JSON.parse(j.result) : j.result) : j;
      for (const a of (Array.isArray(rows) ? rows : rows.records || [])) {
        const link = a.FILE_LINK || a.fileLink;
        if (!link) continue;
        const title = String(a.TITLE || a.title || "").replace(/<[^>]+>/g, "");
        if (NOISE_RE.test(title)) continue;
        const date = a.DATE_TIME ? String(a.DATE_TIME).slice(0, 10).replace(/\//g, "-") : "";
        links.push({ market: "港股", kind, title, date, url: HKEX + link, ...parsePeriod(title, kind, date) });
      }
    } catch (e) { console.error("[fin_reports] 披露易检索", codeWithSuffix, kind, e.message); }
  }
  return { links };
}

// ---------------------------------------------------------------------
// 汇总:按公司实体(带 aShare/hk 字段)取全部报告链接。同主体优先 A 股。
// ---------------------------------------------------------------------
export async function fetchReportLinks(entity, opts = {}) {
  const out = { id: entity.id || entity.name, name: entity.name, links: [], byYear: [], warns: [] };
  if (entity.aShare) {
    const { links, warn } = await aShareReports(entity.aShare, opts);
    out.links.push(...links); if (warn) out.warns.push(warn);
  }
  if (entity.hk) {
    const { links, warn } = await hkReports(entity.hk, opts);
    out.links.push(...links); if (warn) out.warns.push(warn);
  }
  // 同一 (市场,年份,报告期) 只留最早披露的那份(原报优先于更正后重发)
  const seen = new Map();
  for (const l of out.links) {
    const k = `${l.market}|${l.year}|${l.period}`;
    if (!l.period || !l.year) continue;
    const prev = seen.get(k);
    if (!prev || (l.date && prev.date && l.date < prev.date)) seen.set(k, l);
  }
  const uniq = [...seen.values()].sort((a, b) => b.sort - a.sort);
  out.links = uniq;
  // 结构化:按年份分组,每年内按 年报→三季报→半年报→一季报 排列
  const years = [...new Set(uniq.map((l) => l.year))].sort((a, b) => b - a);
  out.byYear = years.map((y) => ({
    year: y,
    items: uniq.filter((l) => l.year === y).sort((a, b) => b.sort - a.sort),
  }));
  return out;
}
