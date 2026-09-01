// 通用检索:博查搜索(+可选 Google News 补充)→ 组装资料 → DeepSeek 按 schema 输出 JSON。
import { bochaSearch } from "./search.js";
import { responsesWebSearch } from "./ds_search.js";
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
  // 博查不可用(尤其额度耗尽)时,自动改用 DeepSeek 原生联网检索 —— 不必逐个功能改代码。
  let quotaHit = false;
  const searched = await pool(queries, 4, async (q) => {
    try {
      const rs = await bochaSearch(q, { count, freshness });
      if (!rs.length) return `### 搜索:${q}\n(无结果)`;
      return `### 搜索:${q}\n` + rs.map((r, i) =>
        `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, summaryLen)}`
      ).join("\n\n");
    } catch (e) {
      if (e && (e.quota || e.code === "QUOTA")) quotaHit = true;
      return `### 搜索:${q}\n(失败:${e.message})`;
    }
  });
  blocks.push(...searched);

  // 兜底:博查全军覆没时,用 DeepSeek 自带联网把素材补回来
  const gotNothing = searched.every((b) => /\(无结果\)|\(失败:/.test(b));
  if (gotNothing || quotaHit) {
    try {
      const instr = "你是资料检索助手。请联网检索下列主题的最新中文报道,把检索到的条目按 [n] 标题 | 来源 | 日期 / URL / 摘要 的格式原样列出,只列事实与真实 URL,不要评论、不要编造链接。";
      const r = await responsesWebSearch(instr, `请检索以下主题(每个主题给 5-8 条,优先最近一个月):\n${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}`, { timeoutMs: 90000 });
      const t = String(r?.text || "").trim();
      const cites = (r?.citations || []).map((c, i) => `[C${i + 1}] ${c.title || ""}\nURL: ${c.url}`).join("\n");
      if (t) blocks.push(`### DeepSeek 联网检索(博查不可用时的替代来源)\n${t}${cites ? "\n\n引用来源:\n" + cites : ""}`);
    } catch (e) { blocks.push(`### DeepSeek 联网检索\n(失败:${e.message})`); }
  }
  const ctx = blocks.join("\n\n");
  const prompt = `${schema}\n\n下面是联网搜索到的资料。请**尽量完整**地依据这些资料整理上述 JSON:资料中出现的、符合范围的条目都要收录,宁可多列也不要遗漏;sources/url 必须取自下面资料里真实出现过的 URL,绝不可编造;某条信息不全时用已有内容填充、缺的字段留空,不要返回空列表。\n\n${ctx}`;
  return chatJSON(prompt, maxTokens, model);
}
