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

  // 检索来源:默认走 DeepSeek 原生联网(不依赖第三方额度)。
  // 想回到博查,把环境变量 SEARCH_PROVIDER 设为 bocha 即可,代码无需改动。
  const provider = (process.env.SEARCH_PROVIDER || "deepseek").toLowerCase();

  async function viaDeepSeek() {
    const instr = "你是资料检索助手。请联网检索下列主题的最新中文报道,把检索到的条目按 [n] 标题 | 来源 | 日期 / URL / 摘要 的格式原样列出;摘要写 2-3 句事实。只列真实存在的条目与真实 URL,不要评论、不要编造链接。";
    const input = `请检索以下主题(每个主题给 ${Math.max(4, Math.min(count, 8))} 条,优先最近一个月):\n${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
    const r = await responsesWebSearch(instr, input, { timeoutMs: 90000 });
    const t = String(r?.text || "").trim();
    if (!t) return [];
    const cites = (r?.citations || []).map((c, i) => `[C${i + 1}] ${c.title || ""}\nURL: ${c.url}`).join("\n");
    return [`### 联网检索结果\n${t}${cites ? "\n\n引用来源:\n" + cites : ""}`];
  }

  async function viaBocha() {
    // 并发限流 4,保持结果顺序
    return await pool(queries, 4, async (q) => {
      try {
        const rs = await bochaSearch(q, { count, freshness });
        if (!rs.length) return `### 搜索:${q}\n(无结果)`;
        return `### 搜索:${q}\n` + rs.map((r, i) =>
          `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, summaryLen)}`
        ).join("\n\n");
      } catch (e) { return `### 搜索:${q}\n(失败:${e.message})`; }
    });
  }

  const primary = provider === "bocha" ? viaBocha : viaDeepSeek;
  const backup = provider === "bocha" ? viaDeepSeek : viaBocha;
  let searched = [];
  try { searched = await primary(); } catch (e) { searched = [`### 检索\n(失败:${e.message})`]; }
  // 主来源没拿到东西时才退到另一条,避免白白多烧一次
  const empty = !searched.length || searched.every((b) => /\(无结果\)|\(失败:/.test(b));
  if (empty) {
    try { const alt = await backup(); if (alt.length) searched = searched.concat(alt); } catch (_) { /* 备用也失败就用已有的 */ }
  }
  blocks.push(...searched);

  const ctx = blocks.join("\n\n");
  const prompt = `${schema}\n\n下面是联网搜索到的资料。请**尽量完整**地依据这些资料整理上述 JSON:资料中出现的、符合范围的条目都要收录,宁可多列也不要遗漏;sources/url 必须取自下面资料里真实出现过的 URL,绝不可编造;某条信息不全时用已有内容填充、缺的字段留空,不要返回空列表。\n\n${ctx}`;
  return chatJSON(prompt, maxTokens, model);
}
