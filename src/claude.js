// 服务端调用 Anthropic Messages API,启用 web_search 工具(服务端执行,无跨域/沙箱限制)。
import { SECTION_PROMPTS, detailPrompt } from "./prompts.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

async function callClaude(prompt, maxTokens = 2000) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("未配置 ANTHROPIC_API_KEY");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }]
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export function parseJSON(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch (_) {}
  // 截断恢复
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
  const prompt = SECTION_PROMPTS[kind];
  if (!prompt) throw new Error("未知板块: " + kind);
  const data = parseJSON(await callClaude(prompt, 2200));
  if (!data) throw new Error("模型返回解析失败");
  return data;
}

export async function getDetail(kind, item) {
  const data = parseJSON(await callClaude(detailPrompt(kind, item), 1400));
  if (!data) throw new Error("模型返回解析失败");
  return data;
}
