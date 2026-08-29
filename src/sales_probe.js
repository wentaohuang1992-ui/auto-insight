// 产销快报探路:探"官方产销快报公告的内容能不能拿到可解析的文本"。
// 东方财富没有结构化月度销量接口(数据中心里销量类只是「公告大全」),所以要么解析产销快报公告、
// 要么退回 DeepSeek 搜索。这个探针决定前者可不可行——
//   1) 拉某 A 股公司的公告列表,筛出「产销快报」;
//   2) 取其中一条的正文,看里面有没有「本月/本年累计/销量/产量」这种可解析的数字文本。
// 若正文是可解析文本 → 官方精确路可做;若只有 PDF 附件、正文空 → 得走 PDF 解析或改用搜索。
//
// 我(沙箱)连不到东方财富,GET /api/fin/sales-probe?company=比亚迪 由 Railway 跑,
// 你把返回 URL 发我(或直接看),我据此定抓法。
import { fetchWithTimeout } from "./http.js";
import { listCompanies } from "./fin_db.js";
import { pickAShare } from "./fin_em.js";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json,text/plain,*/*", "Referer": "https://data.eastmoney.com/" };

export async function probeSales(nameOrId) {
  const c = listCompanies().find((x) => x.id === nameOrId || x.name === nameOrId);
  if (!c) return { error: "未找到车企:" + nameOrId };
  const ashare = pickAShare(c.ticker);
  if (!ashare) return { error: c.name + " 非 A 股(产销快报是 A 股公告)" };
  const code = ashare.replace(/^(SH|SZ)/i, ""); // SZ002594 → 002594
  const out = { company: c.name, code };

  // 1) 公告列表 → 筛产销快报
  try {
    const listUrl = `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=40&page_index=1&ann_type=A&client_source=web&f_node=0&stock_list=${code}`;
    out.listUrl = listUrl;
    const r = await fetchWithTimeout(listUrl, { headers: UA }, 20000);
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { out.listError = "列表非 JSON(疑似拦截/端点变了),前150字:" + t.slice(0, 150); return out; }
    const list = (j && j.data && j.data.list) || j.list || [];
    out.totalAnnFetched = list.length;
    const cx = list.filter((a) => /产销|销量快报/.test(a.notice_title || a.title || ""));
    out.chanxiao = cx.slice(0, 6).map((a) => ({ title: a.notice_title || a.title, date: String(a.notice_date || a.eiTime || "").slice(0, 10), art_code: a.art_code || a.artCode }));
    if (!cx.length) { out.note = "列表里没匹配到「产销」快报——可能该公司不发、或列表字段名不同。sampleTitles 供核对。"; out.sampleTitles = list.slice(0, 6).map((a) => a.notice_title || a.title); return out; }

    // 2) 取一条产销快报正文,看是否可解析
    const one = cx[0], ac = one.art_code || one.artCode;
    if (ac) {
      const cUrl = `https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code=${ac}&client_source=web&page_index=1`;
      out.contentUrl = cUrl;
      const cr = await fetchWithTimeout(cUrl, { headers: UA }, 20000);
      const ct = await cr.text();
      let cj; try { cj = JSON.parse(ct); } catch { out.contentError = "正文非 JSON,前150字:" + ct.slice(0, 150); return out; }
      const content = (cj && cj.data && cj.data.notice_content) || "";
      out.contentLen = content.length;
      out.contentSample = content.replace(/\s+/g, " ").slice(0, 700); // 看有没有本月/累计/销量数字
      out.hasParsableNumbers = /本月|本年累计|销量|产量/.test(content) && /\d{3,}/.test(content);
      out.attachUrl = (cj && cj.data && (cj.data.attach_url || (cj.data.attach_list && cj.data.attach_list[0] && cj.data.attach_list[0].attach_url))) || null;
      out.verdict = out.hasParsableNumbers
        ? "✅ 正文含可解析的销量数字文本 → 产销快报官方路可做(精确、可溯源)"
        : "❌ 正文里没抓到销量数字(可能数字在 PDF 附件里,见 attachUrl)→ 要么解析 PDF,要么改用 DeepSeek 搜索";
    }
  } catch (e) { out.error = e.message; }
  return out;
}
