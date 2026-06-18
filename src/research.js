// 通用检索:跑多条博查搜索,把结果组装成资料,交给 DeepSeek 按 schema 输出 JSON。
import { bochaSearch } from "./search.js";
import { chatJSON } from "./llm.js";

export async function research({ queries, schema, maxTokens = 4096, freshness = "noLimit", count = 8 }) {
  const blocks = [];
  for (const q of queries) {
    try {
      const rs = await bochaSearch(q, { count, freshness });
      if (!rs.length) { blocks.push(`### 搜索:${q}\n(无结果)`); continue; }
      blocks.push(`### 搜索:${q}\n` + rs.map((r, i) =>
        `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, 400)}`
      ).join("\n\n"));
    } catch (e) { blocks.push(`### 搜索:${q}\n(失败:${e.message})`); }
  }
  const ctx = blocks.join("\n\n");
  const prompt = `${schema}\n\n下面是联网搜索到的资料。请**仅依据这些资料**整理上述 JSON;sources/url 必须取自下面资料里真实出现过的 URL,绝不可编造;资料不足时用已有信息填充、缺的留空,不要返回空列表。\n\n${ctx}`;
  return chatJSON(prompt, maxTokens);
}
