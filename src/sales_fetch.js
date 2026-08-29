// 月度销量:从交易所「产销快报」公告取官方正文,让 DeepSeek 只做"从确定文本里抽两个数"
// (当月销量合计 / 本年累计销量合计),入库 salesMonthly。
//
// 为什么这样:各家快报格式差异极大(比亚迪按产品类别、上汽按子公司、长城按品牌,产量/销量列序还相反、
// 多数无总计行),纯正则易抓错;而正文是官方精确文本,LLM 抽数字最稳、一套通吃、加公司零配置。
// 年月从标题正则拿(不劳烦 LLM);来源附公告链接,可溯源。
import { fetchWithTimeout } from "./http.js";
import { listCompanies, upsertSales } from "./fin_db.js";
import { pickAShare } from "./fin_em.js";
import { chatJSON } from "./llm.js";
import { fetchSalesHK } from "./sales_hk.js";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json,text/plain,*/*", "Referer": "https://data.eastmoney.com/" };
const ANN_URL = (code, page = 1) => `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=50&page_index=${page}&ann_type=A&client_source=web&f_node=0&s_node=0&stock_list=${code}`;
const CONTENT_URL = (ac) => `https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code=${ac}&client_source=web&page_index=1`;

// 分页找产销快报:长安这类高频公告户,快报会被挤到前几十条之外 → 逐页翻,找够就停(最多 8 页=400 条)。
async function listChanxiao(code, need = 6) {
  const titleOf = (a) => a.notice_title || a.title || "";
  const cx = []; const seen = new Set(); let sampleTitles = [];
  for (let page = 1; page <= 8; page++) {
    let t, j;
    try { const r = await fetchWithTimeout(ANN_URL(code, page), { headers: UA }, 20000); t = await r.text(); j = JSON.parse(t); }
    catch (e) { if (page === 1) throw new Error("公告列表非 JSON:" + String(t || e.message).slice(0, 100)); break; }
    const list = (j && j.data && j.data.list) || j.list || [];
    if (page === 1) sampleTitles = list.slice(0, 8).map(titleOf);
    for (const a of list) {
      const ti = titleOf(a), ac = a.art_code || a.artCode;
      if (/产[、,，\s]{0,2}销|销量快报|产销数据/.test(ti) && !/业绩/.test(ti) && ac && !seen.has(ac)) {
        seen.add(ac);
        cx.push({ title: ti, date: String(a.notice_date || a.eiTime || "").slice(0, 10), art_code: ac });
      }
    }
    if (cx.length >= need || list.length < 50) break; // 够了、或已到最后一页
  }
  return { cx, sampleTitles };
}

async function fetchContent(ac) {
  const r = await fetchWithTimeout(CONTENT_URL(ac), { headers: UA }, 20000);
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error("正文非 JSON:" + t.slice(0, 100)); }
  return (j && j.data && j.data.notice_content) || "";
}

function ymFromTitle(t) {
  const m = String(t || "").match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  return m ? { year: +m[1], month: +m[2] } : null;
}

// 让 DeepSeek 从确定正文里抽 6 个数(总/新能源/海外 各当月+累计),区分销量/产量、无总计行则求和
async function extractSales(company, ym, content) {
  const prompt = `下面是「${company}」${ym.year}年${ym.month}月产销快报的公告正文。请只抽取以下数字(单位:辆):
1) month_sales:当月「销量」总计(所有品牌/子公司/产品类别合计;有"总计/合计/汽车总计"或"新能源汽车"总行就用,没有就把各明细行当月销量相加)。
2) ytd_sales:本年累计销量总计(1月到本月的累计,必须 ≥ month_sales)。
3) nev_month:当月新能源销量。新能源数字可能在表格的"新能源汽车/新能源"行,也可能在正文单独一句里(如"X月新能源车销售34,651台"),两处都要找。
4) nev_ytd:本年累计新能源销量(可能写作"1-${ym.month}月累计...台")。
5) overseas_month:当月海外/出口销量。同样可能在表格"海外/出口"行,或单独一句(如"X月海外销售62,015台"),两处都找。
6) overseas_ytd:本年累计海外/出口销量。
务必区分"销量"与"产量"两列(有的公司产量列在前),只要销量。累计必须≥当月;新能源、海外都应≤总销量。某项正文确实没有才填 null。
只输出 JSON,不要解释或单位,数字去千分位逗号:{"month_sales":整数,"ytd_sales":整数,"nev_month":整数,"nev_ytd":整数,"overseas_month":整数,"overseas_ytd":整数}。

正文:
${String(content).slice(0, 5000)}`;
  return chatJSON(prompt, 500);
}
// DeepSeek 偶发空/半截响应 → 重试几次(退避)
async function extractSalesRetry(company, ym, content, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { const r = await extractSales(company, ym, content); if (r && r.month_sales != null) return r; lastErr = new Error("返回无 month_sales"); }
    catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw lastErr || new Error("抽取失败");
}
const INT = (v) => (v != null && !isNaN(+v) ? Math.round(+v) : null);

/** 取某公司近 N 个月的月度销量并入库。apply=false 只返回不写库。 */
export async function fetchSales(nameOrId, { months = 6, apply = true } = {}) {
  const c = listCompanies().find((x) => x.id === nameOrId || x.name === nameOrId);
  if (!c) return { error: "未找到车企:" + nameOrId };
  const ashare = pickAShare(c.ticker);
  if (!ashare) return fetchSalesHK(nameOrId, { months, apply }); // 港股/美股 → 原生搜索抓交付
  const code = ashare.replace(/^(SH|SZ)/i, "");
  const out = { company: c.name, code, saved: 0, months: [], errors: [] };
  let anns;
  try { const lc = await listChanxiao(code, months); anns = lc.cx; out.sampleTitles = lc.sampleTitles; }
  catch (e) { out.error = "取公告列表失败:" + e.message; return out; }
  if (!anns.length) { out.error = "没找到产销快报公告(见 sampleTitles 核对该公司公告实际标题)"; return out; }
  delete out.sampleTitles;
  for (const a of anns.slice(0, months)) {
    const ym = ymFromTitle(a.title);
    if (!ym) { out.errors.push({ title: a.title, err: "标题无年月" }); continue; }
    try {
      const content = await fetchContent(a.art_code);
      if (!content || content.length < 120) { out.errors.push({ title: a.title, err: "正文空/太短" }); continue; }
      const ex = await extractSalesRetry(c.name, ym, content);
      let ms = INT(ex && ex.month_sales), ys = INT(ex && ex.ytd_sales);
      let nev = INT(ex && ex.nev_month), nevYtd = INT(ex && ex.nev_ytd);
      let ovs = INT(ex && ex.overseas_month), ovsYtd = INT(ex && ex.overseas_ytd);
      if (ms == null) { out.errors.push({ title: a.title, err: "未抽到当月销量" }); continue; }
      // 勾稽校验:累计须≥当月;新能源/海外须≤当月(留 5% 容差)。不满足则置空,绝不存错值。
      const bad = [];
      if (ys != null && ys < ms) { bad.push(`累计${ys}<当月`); ys = null; }
      if (nev != null && nev > ms * 1.05) { bad.push(`新能源${nev}>当月`); nev = null; }
      if (ovs != null && ovs > ms * 1.05) { bad.push(`海外${ovs}>当月`); ovs = null; }
      if (nevYtd != null && ys != null && nevYtd > ys * 1.05) nevYtd = null;
      if (ovsYtd != null && ys != null && ovsYtd > ys * 1.05) ovsYtd = null;
      const rec = {
        company: c.id, year: ym.year, month: ym.month, sales: ms, ytd: ys,
        nev, nevYtd, overseas: ovs, overseasYtd: ovsYtd,
        sources: [{ title: a.title, url: CONTENT_URL(a.art_code) }],
        note: `产销快报·累计${ys != null ? ys.toLocaleString() : "—"}·新能源${nev != null ? nev.toLocaleString() : "—"}·海外${ovs != null ? ovs.toLocaleString() : "—"}${bad.length ? " ⚠" + bad.join(",") : ""}`,
      };
      if (apply) { const u = upsertSales(rec, { manual: false }); if (u && u.ok !== false) out.saved++; }
      out.months.push({ year: ym.year, month: ym.month, sales: ms, ytd: ys, nev, overseas: ovs, saved: apply, ...(bad.length ? { flagged: bad } : {}) });
    } catch (e) { out.errors.push({ title: a.title, err: e.message }); }
  }
  return out;
}

/** 全量:A 股走产销快报、港股/美股走搜索,各取近 N 个月。 */
export async function fetchAllSales({ months = 6 } = {}) {
  const cs = listCompanies();
  const results = [];
  for (const c of cs) {
    const isA = !!pickAShare(c.ticker);
    try { results.push(await (isA ? fetchSales(c.name, { months }) : fetchSalesHK(c.name, { months }))); }
    catch (e) { results.push({ company: c.name, error: e.message }); }
  }
  return { companies: cs.length, results, at: new Date().toISOString() };
}
