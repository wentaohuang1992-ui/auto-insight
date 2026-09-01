// 新闻 AI 摘要:抓原文正文 → DeepSeek 归纳要点。结果按 URL 缓存,同一条只生成一次。
import { fetchWithTimeout } from "./http.js";
import { chatJSON } from "./llm.js";

/** 抓网页并粗提正文:去掉 script/style/nav 等,再抽纯文本 */
async function fetchArticleText(url) {
  const r = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  }, 20000);
  if (!r.ok) throw new Error(`原文抓取失败 HTTP ${r.status}`);
  const html = await r.text();
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .split("\n").map((s) => s.trim()).filter((s) => s.length > 12)   // 丢掉导航碎片
    .join("\n");
  return body.slice(0, 6000);
}

/**
 * 生成一条新闻的摘要。返回 {summary, points[], url, title, generatedAt, degraded}
 * 抓不到正文时降级:只按标题作背景说明,并标 degraded=true(前端会提示"未取到正文")。
 */
export async function summarizeArticle({ url, title = "", hint = "" }) {
  if (!/^https?:\/\//i.test(url || "")) throw new Error("URL 不合法");
  let text = "", degraded = false;
  try { text = await fetchArticleText(url); } catch (_) { degraded = true; }
  if (text.length < 200) degraded = true;

  const prompt = degraded
    ? `无法获取原文正文。请仅基于下面的标题与已有摘要,谨慎地说明这条新闻大概讲什么,不要编造具体数字、时间或未提及的事实。
标题:${title}
已有摘要:${hint || "(无)"}
只输出 JSON:{"summary":"2-3句说明","points":["要点1","要点2"]}`
    : `请阅读下面的新闻正文,写一份中文摘要。要求:① summary 用 3-4 句话概括核心事实(谁、做了什么、关键数字、影响);② points 给 3-5 条要点,每条一句话,尽量含具体数字或名称;③ 只用正文中出现的信息,不得编造。
标题:${title}
正文:
${text}

只输出 JSON,不要解释或代码块标记:{"summary":"3-4句概括","points":["要点1","要点2","要点3"]}`;

  const d = await chatJSON(prompt, 1600);
  return {
    url, title,
    summary: String(d.summary || "").trim(),
    points: Array.isArray(d.points) ? d.points.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : [],
    degraded,
    generatedAt: new Date().toISOString(),
  };
}
