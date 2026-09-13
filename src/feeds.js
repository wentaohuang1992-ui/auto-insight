// 一手信源订阅层:定时拉固定信源的原文列表,而不是靠关键词搜索拿二手转述。
//
// 设计要点:
//   ① 每个源一个"取列表"的适配器,拿到 [{title,url,date,source}] —— 只做发现,正文按需再取;
//   ② 源清单可配置(存库),你能自己增删,而不是写死在代码里;
//   ③ 单个源失败不影响其它源,失败原因逐条留痕,便于知道哪个源挂了。
import { fetchWithTimeout } from "./http.js";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

const strip = (h) => String(h || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

/** 按 charset 解码(不少行业站仍是 GBK) */
async function getHtml(url) {
  const r = await fetchWithTimeout(url, { headers: UA }, 20000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  let html = buf.toString("utf8");
  const cs = (html.slice(0, 3000).match(/charset=["']?([\w-]+)/i) || [])[1];
  if (cs && /gb2312|gbk|gb18030/i.test(cs)) {
    try { html = new TextDecoder("gb18030").decode(buf); } catch (_) { /* 保持 utf8 */ }
  }
  return html;
}

const absUrl = (href, base) => { try { return new URL(href, base).href; } catch (_) { return ""; } };

/* ---------------- 适配器一:RSS / Atom ---------------- */
export async function pullRss(src) {
  const xml = await getHtml(src.url);
  const items = [];
  const blocks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  for (const b of blocks) {
    const title = strip((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "")
      .replace(/^<!\[CDATA\[|\]\]>$/g, "");
    let link = (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1]
      || (b.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || "";
    link = strip(link);
    const date = strip((b.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "");
    if (title && link) items.push({ title, url: absUrl(link, src.url), date: normDate(date), source: src.name });
  }
  return items;
}

/* ---------------- 适配器二:列表页(按链接模式抓) ---------------- */
// 用 pattern 匹配正文链接,顺带在链接附近找日期。适合协会/政府这类纯 HTML 列表页。
export async function pullList(src) {
  const html = await getHtml(src.url);
  const re = new RegExp(`<a[^>]+href=["']([^"']*${src.pattern}[^"']*)["'][^>]*>([\\s\\S]*?)</a>([\\s\\S]{0,160})`, "gi");
  const items = [];
  const seen = new Set();
  for (const m of html.matchAll(re)) {
    const url = absUrl(m[1], src.url);
    const title = strip(m[2]);
    if (!url || !title || title.length < 6 || seen.has(url)) continue;
    seen.add(url);
    // 链接后面 160 字内找日期(列表页通常紧跟发布时间)
    const d = (m[3].match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/) || []);
    const date = d.length ? `${d[1]}-${String(d[2]).padStart(2, "0")}-${String(d[3]).padStart(2, "0")}` : "";
    items.push({ title, url, date, source: src.name });
  }
  return items;
}

/** 各种日期写法归一成 YYYY-MM-DD */
function normDate(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  const d = new Date(t);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  const m = t.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` : "";
}

/** 默认信源清单:都是行业内公认的一手发布方,可在界面里增删 */
export const DEFAULT_SOURCES = [
  { id: "cada", name: "中国汽车流通协会", kind: "list", url: "https://www.cada.cn/Trends/list_91_1.html", pattern: "/Trends/info_", weight: 10, tags: ["月度数据", "周度车市"], on: true },
  { id: "cpca", name: "乘联分会", kind: "list", url: "https://www.cpcaauto.com/newslist.php?types=csjd", pattern: "news", weight: 10, tags: ["月度数据"], on: true },
  { id: "caam", name: "中汽协", kind: "list", url: "http://www.caam.org.cn/chn/4/cate_39/list_1.html", pattern: "/chn/", weight: 9, tags: ["产销数据"], on: true },
  { id: "miit", name: "工信部·汽车", kind: "list", url: "https://www.miit.gov.cn/jgsj/zbes/qcgy/index.html", pattern: "art_", weight: 9, tags: ["政策", "公告"], on: true },
  { id: "gasgoo", name: "盖世汽车", kind: "rss", url: "https://auto.gasgoo.com/rss/news.xml", weight: 6, tags: ["产业链"], on: true },
  { id: "d1ev", name: "第一电动", kind: "rss", url: "https://www.d1ev.com/rss", weight: 6, tags: ["新能源"], on: true },
];

/** 拉一个源;失败抛错由上层逐条记录 */
export async function pullSource(src) {
  const items = src.kind === "rss" ? await pullRss(src) : await pullList(src);
  return items.slice(0, src.limit || 30).map((x) => ({ ...x, sourceId: src.id, weight: src.weight || 5 }));
}

/** 拉全部启用的源,串行+间隔,失败逐条留痕 */
export async function pullAll(sources) {
  const out = [], errors = [];
  for (const s of sources.filter((x) => x.on !== false)) {
    try {
      const items = await pullSource(s);
      if (!items.length) errors.push(`${s.name}:未解析出条目`);
      out.push(...items);
    } catch (e) { errors.push(`${s.name}:${e.message}`); }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { items: out, errors };
}
