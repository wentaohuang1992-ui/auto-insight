// DeepSeek Responses API + 原生 web_search 封装(与 llm.js 的 chat.completions 平行)。
// 供财报速递的「原生搜索」引擎用:让模型自己联网搜、自己合成,一次调用拿回正文 + 引用。
//
// 返回 { text, citations:[{url,title}], evidence, raw }。
//   text     —— 模型最终输出(财报速递里我们要它输出 JSON,再交给 parseJSON 解析)
//   citations—— 引用链接
//   evidence —— 喂给「待核」数字校验的证据文本
//
// ⚠ evidence 能不能拿到「检索原文片段」,取决于 DeepSeek 实际返回什么。
//   动手接之前,先用 scripts/probe_ds_search.mjs 实调一次看清楚:
//   - 若返回里带片段(snippet/summary/content) → evidence 有料,待核照常跑;
//   - 若只回最终文字 + 光秃秃的链接 → evidence 会很薄,待核会偏严(把更多数字标成待核),
//     这时硬数字仍靠 F10 校验,软数字要么接受弱校验、要么保留博查那条兜底。
import { fetchWithTimeout } from "./http.js";

// Responses API 走 https://api.deepseek.com(不带 /v1),端点 /responses。
const RESP_BASE =
  process.env.DEEPSEEK_BASE_RESP ||
  (process.env.DEEPSEEK_BASE || "https://api.deepseek.com/v1").replace(/\/v1\/?$/, "") ||
  "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
// 内置搜索工具类型;若接口报「未知工具」,设环境变量 DEEPSEEK_SEARCH_TOOL=web_search_preview 再试。
const SEARCH_TOOL = process.env.DEEPSEEK_SEARCH_TOOL || "web_search";

export async function responsesWebSearch(instructions, input, { model = MODEL, timeoutMs = 90000 } = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("缺 DEEPSEEK_API_KEY");
  const res = await fetchWithTimeout(
    `${RESP_BASE}/responses`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, instructions, input, tools: [{ type: SEARCH_TOOL }] }),
    },
    timeoutMs
  );
  const raw = await res.text();
  let json;
  try { json = JSON.parse(raw); } catch { throw new Error("responses 返回非 JSON:" + raw.slice(0, 200)); }
  if (!res.ok) throw new Error(`responses ${res.status}: ${raw.slice(0, 200)}`);
  return extract(json);
}

// 从 Responses 输出里抠出正文、引用、以及尽量多的「检索证据」。
// 字段名按官方 + OpenAI Responses 兼容形态尽量兜全;真实字段以探针结果为准,不对就照探针改这里。
export function extract(json) {
  const output = Array.isArray(json.output) ? json.output : [];
  let text = "";
  const citations = [], evidence = [];
  for (const it of output || []) {
    const type = it.type || "";
    if (type === "message") {
      for (const p of it.content || []) {
        if ((p.type || "").includes("text")) {
          text += p.text || "";
          for (const a of p.annotations || []) {
            if (a.url) citations.push({ url: a.url, title: a.title || "" });
            const snip = a.snippet ?? a.content ?? a.text ?? a.excerpt;
            if (snip) evidence.push(String(snip));
          }
        }
      }
    } else if (type.includes("web_search")) {
      // 服务端检索动作:尽量把里面的检索内容抠出来当证据(字段名依实际响应而定)
      for (const k of ["results", "result", "content", "summary", "snippets", "documents"]) {
        if (it[k] != null) evidence.push(typeof it[k] === "string" ? it[k] : JSON.stringify(it[k]));
      }
    }
  }
  // 便捷字段兜底:部分实现会在顶层给 output_text
  if (!text && typeof json.output_text === "string") text = json.output_text;
  // 证据兜底:没抠到独立片段就用引用标题(聊胜于无,会让待核偏严)
  if (!evidence.length) for (const c of citations) if (c.title) evidence.push(c.title);
  return { text: text.trim(), citations, evidence: evidence.join("\n"), raw: json };
}
