// 通用检索:博查搜索(+可选 Google News 补充)→ 组装资料 → DeepSeek 按 schema 输出 JSON。
import { bochaSearch } from "./search.js";
import { chatJSON } from "./llm.js";
import { googleNewsItems } from "./news_rss.js";
import { pool } from "./pool.js";

export async function research({ queries, schema, maxTokens = 4096, freshness = "noLimit", count = 8, summaryLen = 500, model, gnewsQueries, gnewsWhen = "" }) {
  const blocks = [];

  // 可选:Google News 补充源(对完整度/时效更好)
  if (gnewsQueries && gnewsQueries.length) {
    let gn = [];
    try { gn = await googleNewsItems(gnewsQueries, gnewsWhen); } catch (_) {}
    if (gn.length) blocks.push("### Google 资讯(覆盖更全,请充分采用)\n" + gn.slice(0, 30).map((it, i) => `[G${i + 1}] ${it.title} | ${it.source || ""} | ${it.dateISO || it.date || ""}\nURL: ${it.url}`).join("\n\n"));
  }

  // 并发检索(限流 4),保持结果顺序;此前串行,10 个查询要串起 10 个 RTT。
  const searched = await pool(queries, 4, async (q) => {
    try {
      const rs = await bochaSearch(q, { count, freshness });
      if (!rs.length) return `### 搜索:${q}\n(无结果)`;
      return `### 搜索:${q}\n` + rs.map((r, i) =>
        `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, summaryLen)}`
      ).join("\n\n");
    } catch (e) { return `### 搜索:${q}\n(失败:${e.message})`; }
  });
  blocks.push(...searched);
  const ctx = blocks.join("\n\n");
  const prompt = `${schema}\n\n下面是联网搜索到的资料。请**尽量完整**地依据这些资料整理上述 JSON:资料中出现的、符合范围的条目都要收录,宁可多列也不要遗漏;sources/url 必须取自下面资料里真实出现过的 URL,绝不可编造;某条信息不全时用已有内容填充、缺的字段留空,不要返回空列表。\n\n${ctx}`;
  return chatJSON(prompt, maxTokens, model);
}
