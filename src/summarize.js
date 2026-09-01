// 新闻 AI 摘要:抓原文正文 → DeepSeek 归纳要点。结果按 URL 缓存,同一条只生成一次。
import { fetchWithTimeout } from "./http.js";
import { chatJSON } from "./llm.js";
import { responsesWebSearch } from "./ds_search.js";

/** 第二来源:阅读器代理。它会真正渲染页面(含 JS)并返回干净正文,能解决脚本渲染与多数反爬。 */
async function fetchViaReader(url) {
  // r.jina.ai 直接在原链接前加前缀即可;可用 READER_PREFIX 换成自建/其他服务
  // 免密钥调用近来常被限流(403),设 JINA_API_KEY 后额度与成功率明显提高
  const prefix = process.env.READER_PREFIX || "https://r.jina.ai/";
  const headers = { "Accept": "text/plain", "User-Agent": "auto-insight/1.0", "X-Return-Format": "text" };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const r = await fetchWithTimeout(prefix + url, { headers }, 7000);
  if (!r.ok) throw new Error(`阅读器 HTTP ${r.status}${r.status === 403 ? "(未配置 JINA_API_KEY 或已限流)" : ""}`);
  let t = await r.text();
  // 去掉阅读器自带的头部元信息(Title:/URL Source:/Markdown Content: 等)
  t = t.replace(/^(Title|URL Source|Published Time|Markdown Content|Warning):.*$/gim, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")        // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")      // 链接保留文字
    .split("\n").map((s) => s.trim()).filter((s) => s.length > 12).join("\n");
  if (t.length < 200) throw new Error("阅读器返回内容过短");
  return t.slice(0, 4500);
}

/** 第三来源:互联网档案馆快照。原站已下线或临时反爬时,快照往往仍可读。 */
async function fetchViaArchive(url) {
  const r = await fetchWithTimeout(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
    headers: { "Accept": "application/json" },
  }, 6000);
  if (!r.ok) throw new Error(`快照查询 HTTP ${r.status}`);
  const j = await r.json();
  const snap = j?.archived_snapshots?.closest;
  if (!snap?.available || !snap.url) throw new Error("无可用快照");
  return await fetchArticleText(snap.url);
}

/** 第四来源:DeepSeek 原生联网检索。让模型自己去读这条新闻,返回正文要点(不依赖博查额度)。 */
async function fetchViaDeepSeek(url, title) {
  const instr = "你是新闻资料整理助手。请联网打开给定链接(或检索同一条新闻的可靠来源),读取正文后,把正文里的事实**尽量完整**地列出来:发生时间、涉及主体、**所有出现过的数字(销量/金额/同比环比/份额/排名/日期)**、事件经过、各方原话表态、背景与对比。宁可多列也不要漏,每条一行。只输出事实,不要评论、不要下结论、不要编造。若确实找不到该新闻,只回复:NOTFOUND";
  const input = `链接:${url}\n标题:${title || "(无)"}\n请读取这条新闻的正文内容。`;
  const r = await responsesWebSearch(instr, input, { timeoutMs: 45000 });
  const t = String(r?.text || "").trim();
  if (!t || /^NOTFOUND/i.test(t)) throw new Error("联网检索未找到该新闻");
  // 把检索到的证据片段一并带上,信息更全
  const ev = Array.isArray(r.evidence) ? r.evidence.join("\n").slice(0, 2000) : "";
  const merged = (t + (ev ? "\n" + ev : "")).slice(0, 4500);
  if (merged.length < 160) throw new Error("联网检索内容过短");
  return merged;
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
  }, 5000);
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
  if (text.length < 160) throw new Error("正文过短或为脚本渲染");
  return text.slice(0, 4500);
}

/**
 * 生成一条新闻的摘要。返回 {summary, points[], url, title, generatedAt, degraded}
 * 抓不到正文时降级:只按标题作背景说明,并标 degraded=true(前端会提示"未取到正文")。
 */
export async function summarizeArticle({ url, title = "", hint = "" }) {
  if (!/^https?:\/\//i.test(url || "")) throw new Error("URL 不合法");
  // 取正文:四条**同时**发。快路(原文/阅读器/快照)谁先回就用谁;
  // 慢路(DeepSeek 联网)也在 t=0 启动 —— 以前是等快路超时后才开始,时间白白叠加。
  const tried = [];
  const wrap = (name, fn) => fn().then(
    (t) => (t && t.length >= 160) ? { name, text: t } : (tried.push(`${name}:内容过短`), null),
    (e) => (tried.push(`${name}:${e.message}`), null)
  );
  const pFast = [
    wrap("原文", () => fetchArticleText(url)),
    wrap("阅读器", () => fetchViaReader(url)),
    wrap("历史快照", () => fetchViaArchive(url)),
  ];
  const pSlow = wrap("联网检索", () => fetchViaDeepSeek(url, title));

  // 先等快路:任一成功立即返回;全失败才去看慢路(此时它已经跑了好几秒)
  const firstOf = (arr) => new Promise((resolve) => {
    let left = arr.length;
    if (!left) return resolve(null);
    for (const p of arr) p.then((r) => { if (r) resolve(r); else if (--left === 0) resolve(null); });
  });
  const tFetch0 = Date.now();
  let got = await firstOf(pFast);
  if (!got) got = await pSlow;
  else pSlow.catch(() => {});          // 快路已中标,慢路结果丢弃,避免未处理的 rejection

  const fetchMs = Date.now() - tFetch0;
  const text = got?.text || "", source = got?.name || "";
  if (!text) {
    const joined = tried.join(" / ");
    // 额度/欠费类错误单独点明 —— 这类不是代码问题,改代码也没用
    if (/enough money|package quota|余额|欠费|quota/i.test(joined)) {
      throw new Error(`搜索服务额度已用尽,同时原文与阅读器均不可读,无法生成摘要。请先为博查搜索账户充值/续费。\n明细:${joined}`);
    }
    throw new Error(`四种途径都未取到正文,已跳过摘要生成 · ${joined}`);
  }

  const prompt = `阅读下面的新闻内容,输出结构化中文摘要。严格只用内容中出现的信息,不得编造;内容里没有的字段留空或省略。

要求:
1. summary:3-4 句话讲清楚这件事 —— 谁、在什么时间、做了什么、关键数字、目前进展。
2. facts:把内容里出现的**具体数据**逐条抽出来,每条 {"k":"指标名","v":"数值(含单位)"};
   例如 {"k":"5月销量","v":"38.35万辆"}、{"k":"出口","v":"18.19万辆"}、{"k":"同比","v":"+21.8%"}。
   有几条抽几条,尽量抽全(4-8 条);一个数字都没有就给空数组。
3. points:4-6 条要点,每条一句完整的话(20-45 字),覆盖不同侧面(格局/原因/对比/进展/表态),不要与 summary 重复措辞。
4. impact:一句话说明这件事对行业或相关公司意味着什么(只在内容里有依据时写,否则留空)。
5. 用你自己的话组织,不要整段照抄原文。

标题:${title}
内容:
${text}

只输出 JSON,不要解释或代码块标记:
{"summary":"...","facts":[{"k":"...","v":"..."}],"points":["...","..."],"impact":"..."}`;

  const tGen0 = Date.now();
  const d = await chatJSON(prompt, 1200);
  const genMs = Date.now() - tGen0;
  return {
    url, title,
    summary: String(d.summary || "").trim(),
    facts: Array.isArray(d.facts) ? d.facts.filter((x) => x && x.k && x.v)
      .map((x) => ({ k: String(x.k).trim(), v: String(x.v).trim() })).slice(0, 10) : [],
    points: Array.isArray(d.points) ? d.points.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [],
    impact: String(d.impact || "").trim(),
    source,
    timings: { fetchMs, genMs, chars: text.length },
    generatedAt: new Date().toISOString(),
  };
}
