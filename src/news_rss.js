// 实时新闻源:Google News RSS(免费、无需 key、对当天新闻收录快、支持中文)。
// 用 when:2d 限定最近 2 天;服务器端抓取,返回 {title,url,source,date,dateISO}。
const BASE = "https://news.google.com/rss/search";
function gnUrl(q, when = "2d") { const w = when ? ` when:${when}` : ""; return `${BASE}?q=${encodeURIComponent(q + w)}&hl=zh-CN&gl=CN&ceid=CN:zh`; }
function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}
function parseItems(xml) {
  const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    let title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = decode((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const pub = decode((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
    let source = decode((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]);
    if (!source && title.includes(" - ")) { const i = title.lastIndexOf(" - "); source = title.slice(i + 3); title = title.slice(0, i); }
    let dateISO = ""; try { dateISO = new Date(pub).toISOString().slice(0, 10); } catch (_) {}
    if (title) items.push({ title, url: link, source, date: pub, dateISO });
  }
  return items;
}
export async function googleNewsItems(queries, when = "2d") {
  const out = [];
  for (const q of queries) {
    try {
      const res = await fetch(gnUrl(q, when), { headers: { "user-agent": "Mozilla/5.0 (compatible; auto-insight/1.0)" } });
      if (!res.ok) continue;
      const xml = await res.text();
      out.push(...parseItems(xml).slice(0, 12));
    } catch (_) { /* 单条失败跳过 */ }
  }
  const seen = new Set(), uniq = [];
  for (const it of out) { const k = (it.title || "").replace(/\s+/g, ""); if (k && !seen.has(k)) { seen.add(k); uniq.push(it); } }
  return uniq;
}
