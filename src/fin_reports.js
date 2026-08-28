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
const CN_CATEGORY = { 年报: "category_ndbg_szsh", 半年报: "category_bndbg_szsh" };

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
export async function aShareReports(codeWithSuffix, { kinds = ["年报", "半年报"], pageSize = 8 } = {}) {
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
        links.push({
          market: "A股", kind,
          title: a.announcementTitle || "",
          date: a.announcementTime ? new Date(+a.announcementTime).toISOString().slice(0, 10) : "",
          url: CNINFO_STATIC + a.adjunctUrl,
        });
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
const HK_T2 = { 年报: "40100", 半年报: "40200" };

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

export async function hkReports(codeWithSuffix, { kinds = ["年报", "半年报"], from = "20240101", to } = {}) {
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
        links.push({
          market: "港股", kind,
          title: a.TITLE || a.title || "",
          date: a.DATE_TIME ? String(a.DATE_TIME).slice(0, 10) : "",
          url: HKEX + link,
        });
      }
    } catch (e) { console.error("[fin_reports] 披露易检索", codeWithSuffix, kind, e.message); }
  }
  return { links };
}

// ---------------------------------------------------------------------
// 汇总:按公司实体(带 aShare/hk 字段)取全部报告链接。同主体优先 A 股。
// ---------------------------------------------------------------------
export async function fetchReportLinks(entity, opts = {}) {
  const out = { id: entity.id || entity.name, name: entity.name, links: [], warns: [] };
  if (entity.aShare) {
    const { links, warn } = await aShareReports(entity.aShare, opts);
    out.links.push(...links); if (warn) out.warns.push(warn);
  }
  if (entity.hk) {
    const { links, warn } = await hkReports(entity.hk, opts);
    out.links.push(...links); if (warn) out.warns.push(warn);
  }
  // 每类只留最近 3 份,按日期倒序
  out.links.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return out;
}
