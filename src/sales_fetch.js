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

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json,text/plain,*/*", "Referer": "https://data.eastmoney.com/" };
const ANN_URL = (code) => `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=40&page_index=1&ann_type=A&client_source=web&f_node=0&stock_list=${code}`;
const CONTENT_URL = (ac) => `https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code=${ac}&client_source=web&page_index=1`;

async function listChanxiao(code) {
  const r = await fetchWithTimeout(ANN_URL(code), { headers: UA }, 20000);
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error("公告列表非 JSON:" + t.slice(0, 100)); }
  const list = (j && j.data && j.data.list) || j.list || [];
  return list
    .filter((a) => /产销/.test(a.notice_title || a.title || ""))
    .map((a) => ({ title: a.notice_title || a.title, date: String(a.notice_date || a.eiTime || "").slice(0, 10), art_code: a.art_code || a.artCode }));
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

// 让 DeepSeek 从确定正文里抽两个数(区分销量/产量、处理无总计行需求和)
async function extractSales(company, ym, content) {
  const prompt = `下面是「${company}」${ym.year}年${ym.month}月产销快报的公告正文。请只从这段文本里抽取两个数字:
1) 当月「销量」总计:所有品牌/子公司/产品类别的销量合计。若正文有"新能源汽车"总行或"合计/总计"行就用它;若没有总计行,就把各明细行的当月销量相加。
2) 「本年累计销量」总计:同样口径,取累计销量。
务必区分"销量"与"产量"两列(有的公司产量列在前、有的销量列在前),只要销量。
只输出 JSON,不要任何解释或单位:{"month_sales":整数,"ytd_sales":整数}。数字去掉千分位逗号;抽不到填 null。

正文:
${String(content).slice(0, 3500)}`;
  return chatJSON(prompt, 200);
}

/** 取某公司近 N 个月的月度销量并入库。apply=false 只返回不写库。 */
export async function fetchSales(nameOrId, { months = 6, apply = true } = {}) {
  const c = listCompanies().find((x) => x.id === nameOrId || x.name === nameOrId);
  if (!c) return { error: "未找到车企:" + nameOrId };
  const ashare = pickAShare(c.ticker);
  if (!ashare) return { error: c.name + " 非 A 股(产销快报是 A 股公告)" };
  const code = ashare.replace(/^(SH|SZ)/i, "");
  const out = { company: c.name, code, saved: 0, months: [], errors: [] };
  let anns;
  try { anns = await listChanxiao(code); } catch (e) { out.error = "取公告列表失败:" + e.message; return out; }
  if (!anns.length) { out.error = "没找到产销快报公告"; return out; }
  for (const a of anns.slice(0, months)) {
    const ym = ymFromTitle(a.title);
    if (!ym) { out.errors.push({ title: a.title, err: "标题无年月" }); continue; }
    try {
      const content = await fetchContent(a.art_code);
      if (!content || content.length < 120) { out.errors.push({ title: a.title, err: "正文空/太短" }); continue; }
      const ex = await extractSales(c.name, ym, content);
      const ms = ex && ex.month_sales != null && !isNaN(+ex.month_sales) ? Math.round(+ex.month_sales) : null;
      const ys = ex && ex.ytd_sales != null && !isNaN(+ex.ytd_sales) ? Math.round(+ex.ytd_sales) : null;
      if (ms == null) { out.errors.push({ title: a.title, err: "未抽到当月销量" }); continue; }
      const rec = {
        company: c.id, year: ym.year, month: ym.month, sales: ms,
        sources: [{ title: a.title, url: CONTENT_URL(a.art_code) }],
        note: `产销快报·本年累计销量 ${ys != null ? ys.toLocaleString() : "—"}`,
      };
      if (apply) { const u = upsertSales(rec, { manual: false }); if (u && u.ok !== false) out.saved++; }
      out.months.push({ year: ym.year, month: ym.month, sales: ms, ytd: ys, saved: apply });
    } catch (e) { out.errors.push({ title: a.title, err: e.message }); }
  }
  return out;
}

/** 全量:所有 A 股车企各取近 N 个月。 */
export async function fetchAllSales({ months = 6 } = {}) {
  const cs = listCompanies().filter((c) => pickAShare(c.ticker));
  const results = [];
  for (const c of cs) {
    try { results.push(await fetchSales(c.name, { months })); }
    catch (e) { results.push({ company: c.name, error: e.message }); }
  }
  return { companies: cs.length, results, at: new Date().toISOString() };
}
