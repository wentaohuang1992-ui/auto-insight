// 服务端调用 Anthropic Messages API,启用 web_search 工具。
import { sectionPrompt, detailPrompt } from "./prompts.js";
import { today } from "./dates.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

async function callClaude(prompt, maxTokens = 4096, maxUses = 4) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("未配置 ANTHROPIC_API_KEY");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses }]
    })
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`); }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return { text, stop: data.stop_reason };
}

export function parseJSON(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch (_) {}
  try {
    const cut = t.lastIndexOf("}");
    if (cut > 0) {
      let f = t.slice(0, cut + 1);
      if ((f.match(/\[/g) || []).length > (f.match(/\]/g) || []).length) f += "]";
      if ((f.match(/\{/g) || []).length > (f.match(/\}/g) || []).length) f += "}";
      return JSON.parse(f);
    }
  } catch (_) {}
  return null;
}

export async function getSection(kind) {
  const { cn } = today();
  const { text, stop } = await callClaude(sectionPrompt(kind, cn), 4096, 4);
  const data = parseJSON(text);
  if (!data) throw new Error("模型返回解析失败 · " + (text ? text.slice(0, 160) : `无文本返回(stop=${stop})`));
  return data;
}

export async function getDetail(kind, item) {
  const { cn } = today();
  const { text, stop } = await callClaude(detailPrompt(kind, item, cn), 2048, 3);
  const data = parseJSON(text);
  if (!data) throw new Error("模型返回解析失败 · " + (text ? text.slice(0, 160) : `无文本返回(stop=${stop})`));
  return data;
}
