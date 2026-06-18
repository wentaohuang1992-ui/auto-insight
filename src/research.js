// 通用检索:跑多条博查搜索,把结果组装成资料,交给 DeepSeek 按 schema 输出 JSON。
import { bochaSearch } from "./search.js";
import { chatJSON } from "./llm.js";

export async function research({ queries, schema, maxTokens = 4096, freshness = "noLimit", count = 8, summaryLen = 500, model }) {
  const blocks = [];
  for (const q of queries) {
    try {
      const rs = await bochaSearch(q, { count, freshness });
      if (!rs.length) { blocks.push(`### 搜索:${q}\n(无结果)`); continue; }
      blocks.push(`### 搜索:${q}\n` + rs.map((r, i) =>
        `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, summaryLen)}`
      ).join("\n\n"));
    } catch (e) { blocks.push(`### 搜索:${q}\n(失败:${e.message})`); }
  }
  const ctx = blocks.join("\n\n");
  const prompt = `${schema}\n\n下面是联网搜索到的资料。请**尽量完整**地依据这些资料整理上述 JSON:资料中出现的、符合范围的条目都要收录,宁可多列也不要遗漏;sources/url 必须取自下面资料里真实出现过的 URL,绝不可编造;某条信息不全时用已有内容填充、缺的字段留空,不要返回空列表。\n\n${ctx}`;
  return chatJSON(prompt, maxTokens, model);
}
