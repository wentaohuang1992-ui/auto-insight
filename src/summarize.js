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
  return t.slice(0, 3000);
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
  const instr = "你是新闻资料整理助手。请联网打开给定链接(或检索同一条新闻的可靠来源),读取正文后,把正文的关键事实原样整理出来:时间、主体、数字、事件经过、各方表态。只输出事实,不要评论、不要总结成结论、不要编造。若确实找不到该新闻,只回复:NOTFOUND";
  const input = `链接:${url}\n标题:${title || "(无)"}\n请读取这条新闻的正文内容。`;
  const r = await responsesWebSearch(instr, input, { timeoutMs: 45000 });
  const t = String(r?.text || "").trim();
  if (!t || /^NOTFOUND/i.test(t)) throw new Error("联网检索未找到该新闻");
  // 把检索到的证据片段一并带上,信息更全
  const ev = Array.isArray(r.evidence) ? r.evidence.join("\n").slice(0, 2000) : "";
  const merged = (t + (ev ? "\n" + ev : "")).slice(0, 3000);
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
  return text.slice(0, 3000);
}

/**
 * 生成一条新闻的摘要。返回 {summary, points[], url, title, generatedAt, degraded}
 * 抓不到正文时降级:只按标题作背景说明,并标 degraded=true(前端会提示"未取到正文")。
 */
export async function summarizeArticle({ url, title = "", hint = "" }) {
  if (!/^https?:\/\//i.test(url || "")) throw new Error("URL 不合法");
  // 取正文:三条快路**并行竞速**,谁先拿到可用正文就用谁(串行时第一级超时就要白等几秒)
  // 慢路(DeepSeek 联网,几十秒)只在快路全灭时才走,不拖累常规链路
  const fast = [
    ["原文", () => fetchArticleText(url)],
    ["阅读器", () => fetchViaReader(url)],
    ["历史快照", () => fetchViaArchive(url)],
  ];
  const tried = [];
  const race = () => new Promise((resolve) => {
    let left = fast.length;
    for (const [name, fn] of fast) {
      fn().then((t) => {
        if (t && t.length >= 160) resolve({ text: t, source: name });
        else { tried.push(`${name}:内容过短`); if (--left === 0) resolve(null); }
      }).catch((e) => {
        tried.push(`${name}:${e.message}`);
        if (--left === 0) resolve(null);
      });
    }
  });
  let got = await race();
  if (!got) {
    // 快路都不行,再走慢路
    try {
      const t = await fetchViaDeepSeek(url, title);
      if (t && t.length >= 160) got = { text: t, source: "联网检索" };
      else tried.push("联网检索:内容过短");
    } catch (e) { tried.push(`联网检索:${e.message}`); }
  }
  const text = got?.text || "", source = got?.source || "";
  if (!text) {
    const joined = tried.join(" / ");
    // 额度/欠费类错误单独点明 —— 这类不是代码问题,改代码也没用
    if (/enough money|package quota|余额|欠费|quota/i.test(joined)) {
      throw new Error(`搜索服务额度已用尽,同时原文与阅读器均不可读,无法生成摘要。请先为博查搜索账户充值/续费。\n明细:${joined}`);
    }
    throw new Error(`四种途径都未取到正文,已跳过摘要生成 · ${joined}`);
  }

  const prompt = `阅读下面的新闻内容,输出中文摘要。要求:summary 用 2-3 句概括核心事实(谁、做了什么、关键数字);points 给 3 条要点,每条不超过 25 字,尽量含数字或名称;只用下面内容中出现的信息,不得编造;用自己的话概括,不要照抄原文。
标题:${title}
内容:
${text}

只输出 JSON,不要解释或代码块标记:{"summary":"3-4句概括","points":["要点1","要点2","要点3"]}`;

  const d = await chatJSON(prompt, 700);
  return {
    url, title,
    summary: String(d.summary || "").trim(),
    points: Array.isArray(d.points) ? d.points.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : [],
    source,
    generatedAt: new Date().toISOString(),
  };
}
