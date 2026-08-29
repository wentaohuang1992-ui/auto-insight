// DeepSeek(OpenAI 兼容)客户端 + 健壮 JSON 解析(多级兜底)。
import { fetchWithTimeout } from "./http.js";

const BASE = process.env.DEEPSEEK_BASE || "https://api.deepseek.com/v1";
// 大模型生成慢,单独给一个更长的超时。
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 120000);
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

async function rawChat(body) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("未配置 DEEPSEEK_API_KEY");
  const res = await fetchWithTimeout(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  }, LLM_TIMEOUT_MS);
  if (!res.ok) { const t = await res.text().catch(() => ""); const e = new Error(`DeepSeek ${res.status}: ${t.slice(0, 220)}`); e.status = res.status; throw e; }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

export function parseJSON(text) {
  if (!text) return null;
  let t = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  const tryP = (x) => { try { return JSON.parse(x); } catch (_) { return null; } };
  let r = tryP(t); if (r) return r;
  // 去掉尾逗号再试
  r = tryP(t.replace(/,\s*([}\]])/g, "$1")); if (r) return r;
  // 截断恢复:从第一个 { 起按括号配平补齐
  const from = t.indexOf("{");
  if (from >= 0) {
    t = t.replace(/,\s*"[^"]*"?\s*:?\s*$/, ""); // 丢掉结尾没写完的键(如 ...,"overseas_ 或 ...,"key":)
    let depthC = 0, depthB = 0, inStr = false, esc = false, cut = -1;
    for (let i = from; i < t.length; i++) {
      const ch = t[i];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{") depthC++;
      else if (ch === "}") { depthC--; if (depthC === 0 && depthB === 0) { cut = i + 1; break; } }
      else if (ch === "[") depthB++;
      else if (ch === "]") depthB--;
    }
    let frag = cut > 0 ? t.slice(from, cut) : t.slice(from);
    frag = frag.replace(/,\s*$/, "");
    while (depthB-- > 0) frag += "]";
    while (depthC-- > 0) frag += "}";
    r = tryP(frag) || tryP(frag.replace(/,\s*([}\]])/g, "$1"));
    if (r) return r;
  }
  return null;
}

export async function chatJSON(prompt, maxTokens = 4096, model = DEEPSEEK_MODEL) {
  const sys = "你是中文财经与汽车行业数据整理助手。只输出一个 JSON 对象,不要任何额外文字、解释或 markdown 代码块。";
  const base = { model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "system", content: sys }, { role: "user", content: prompt }] };
  let last = "";
  // 1) JSON 强制模式
  try { const t = await rawChat({ ...base, response_format: { type: "json_object" } }); last = t || last; const p = t && parseJSON(t); if (p) return p; } catch (_) {}
  // 2) 普通模式
  try { const t = await rawChat(base); last = t || last; const p = t && parseJSON(t); if (p) return p; } catch (_) {}
  // 3) 普通模式 + 硬约束
  try { const t = await rawChat({ ...base, messages: [...base.messages, { role: "user", content: "立刻只输出 JSON 对象,第一个字符必须是 {,不要任何其他文字。" }] }); last = t || last; const p = t && parseJSON(t); if (p) return p; } catch (e) { if (!last) throw e; }
  throw new Error("DeepSeek 返回解析失败 · " + (last ? last.slice(0, 160) : "(空响应)"));
}
