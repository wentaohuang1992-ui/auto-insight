// 新闻 AI 摘要:抓原文正文 → DeepSeek 归纳要点。结果按 URL 缓存,同一条只生成一次。
import { fetchWithTimeout } from "./http.js";
import { chatJSON } from "./llm.js";
import { bochaSearch } from "./search.js";

/** 第二来源:阅读器代理。它会真正渲染页面(含 JS)并返回干净正文,能解决脚本渲染与多数反爬。 */
async function fetchViaReader(url) {
  // r.jina.ai 直接在原链接前加前缀即可;可用 READER_PREFIX 换成自建/其他服务
  const prefix = process.env.READER_PREFIX || "https://r.jina.ai/";
  const r = await fetchWithTimeout(prefix + url, {
    headers: { "Accept": "text/plain", "User-Agent": "auto-insight/1.0", "X-Return-Format": "text" },
  }, 25000);
  if (!r.ok) throw new Error(`阅读器 HTTP ${r.status}`);
  let t = await r.text();
  // 去掉阅读器自带的头部元信息(Title:/URL Source:/Markdown Content: 等)
  t = t.replace(/^(Title|URL Source|Published Time|Markdown Content|Warning):.*$/gim, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")        // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")      // 链接保留文字
    .split("\n").map((s) => s.trim()).filter((s) => s.length > 12).join("\n");
  if (t.length < 200) throw new Error("阅读器返回内容过短");
  return t.slice(0, 6000);
}

/** 第三来源:互联网档案馆快照。原站已下线或临时反爬时,快照往往仍可读。 */
async function fetchViaArchive(url) {
  const r = await fetchWithTimeout(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
    headers: { "Accept": "application/json" },
  }, 15000);
  if (!r.ok) throw new Error(`快照查询 HTTP ${r.status}`);
  const j = await r.json();
  const snap = j?.archived_snapshots?.closest;
  if (!snap?.available || !snap.url) throw new Error("无可用快照");
  return await fetchArticleText(snap.url);
}

/** 第四来源:搜索引擎返回的正文摘要(博查带 summary 字段) */
async function fetchViaSearch(url, title) {
  if (!title) return "";
  const rs = await bochaSearch(title, { count: 6 });
  const host = (() => { try { return new URL(url).host; } catch (_) { return ""; } })();
  const norm = (s) => String(s || "").replace(/\s|【|】|"|"/g, "");
  const key = norm(title).slice(0, 14);
  const hit = rs.find((x) => x.url === url)
    || rs.find((x) => host && String(x.url || "").includes(host) && norm(x.title).includes(key))
    || rs.find((x) => norm(x.title).includes(key));
  if (!hit) return "";
  const body = [hit.summary, hit.snippet].filter(Boolean).join("\n");
  return body.length > 150 ? body.slice(0, 4000) : "";
}

/** 抓网页并粗提正文。失败时抛出带原因的错误,便于上层区分处理。 */
async function fetchArticleText(url) {
  const u = new URL(url);
  const r = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Referer": `${u.protocol}//${u.host}/`,
    },
  }, 20000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  // 部分站点是 GBK,按 charset 解码,否则中文会变乱码(乱码等同于没正文)
  const buf = Buffer.from(await r.arrayBuffer());
  let html = buf.toString("utf8");
  const cs = (html.match(/charset=["']?([\w-]+)/i) || [])[1];
  if (cs && /gb2312|gbk|gb18030/i.test(cs)) {
    try { html = new TextDecoder("gb18030").decode(buf); } catch (_) { /* 保持 utf8 */ }
  }
  // 优先取常见正文容器,取不到再退回整页
  const zones = [];
  const re = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m; while ((m = re.exec(html))) zones.push(m[2]);
  const divRe = /<div[^>]+(?:id|class)=["'][^"']*(?:article|content|artibody|post-?body|main-?text|detail)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  while ((m = divRe.exec(html))) zones.push(m[1]);
  const pick = zones.sort((a, b) => b.length - a.length)[0] || html;

  const text = pick
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&#\d+;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .split("\n").map((s) => s.trim()).filter((s) => s.length > 12)
    .join("\n");
  if (text.length < 200) throw new Error("正文过短或为脚本渲染");
  return text.slice(0, 6000);
}

/**
 * 生成一条新闻的摘要。返回 {summary, points[], url, title, generatedAt, degraded}
 * 抓不到正文时降级:只按标题作背景说明,并标 degraded=true(前端会提示"未取到正文")。
 */
export async function summarizeArticle({ url, title = "", hint = "" }) {
  if (!/^https?:\/\//i.test(url || "")) throw new Error("URL 不合法");
  // 四级取正文:原文直抓 → 阅读器代理(可渲染JS) → 档案馆快照 → 搜索正文摘要
  const tiers = [
    ["原文", () => fetchArticleText(url)],
    ["阅读器", () => fetchViaReader(url)],
    ["历史快照", () => fetchViaArchive(url)],
    ["搜索正文", () => fetchViaSearch(url, title)],
  ];
  let text = "", source = "";
  const tried = [];
  for (const [name, fn] of tiers) {
    try {
      const t = await fn();
      if (t && t.length >= 200) { text = t; source = name; break; }
      tried.push(`${name}:内容过短`);
    } catch (e) { tried.push(`${name}:${e.message}`); }
  }
  if (!text) throw new Error(`四种途径都未取到正文,已跳过摘要生成 · ${tried.join(" / ")}`);

  const prompt = `请阅读下面的新闻内容,写一份中文摘要。要求:① summary 用 3-4 句话概括核心事实(谁、做了什么、关键数字、影响);② points 给 3-5 条要点,每条一句话,尽量含具体数字或名称;③ 只用下面内容中出现的信息,不得编造;内容里没有的数字一律不写;④ 用你自己的话概括,不要整段照抄原文。
标题:${title}
内容(来源:${source}):
${text}

只输出 JSON,不要解释或代码块标记:{"summary":"3-4句概括","points":["要点1","要点2","要点3"]}`;

  const d = await chatJSON(prompt, 1600);
  return {
    url, title,
    summary: String(d.summary || "").trim(),
    points: Array.isArray(d.points) ? d.points.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : [],
    source,
    generatedAt: new Date().toISOString(),
  };
}
