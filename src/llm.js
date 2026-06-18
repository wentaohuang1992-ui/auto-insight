// DeepSeek(OpenAI 兼容)客户端 + 健壮 JSON 解析。
const BASE = process.env.DEEPSEEK_BASE || "https://api.deepseek.com/v1";
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

async function rawChat(body) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("未配置 DEEPSEEK_API_KEY");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); const e = new Error(`DeepSeek ${res.status}: ${t.slice(0, 220)}`); e.status = res.status; throw e; }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
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

export async function chatJSON(prompt, maxTokens = 4096) {
  const sys = "你是中文财经与汽车行业数据整理助手。只输出一个 JSON 对象,不要任何额外文字、解释或 markdown 代码块。";
  const base = { model: DEEPSEEK_MODEL, max_tokens: maxTokens, temperature: 0.2,
    messages: [{ role: "system", content: sys }, { role: "user", content: prompt }] };
  let txt;
  try { txt = await rawChat({ ...base, response_format: { type: "json_object" } }); }
  catch (e) { txt = await rawChat(base); } // 个别模型不支持 json_object 时退回普通模式
  let parsed = parseJSON(txt);
  if (!parsed) {
    const txt2 = await rawChat({ ...base, messages: [...base.messages, { role: "user", content: "立刻只输出 JSON,第一个字符必须是 {。" }] });
    parsed = parseJSON(txt2);
    if (!parsed) throw new Error("DeepSeek 返回解析失败 · " + ((txt || txt2 || "").slice(0, 160)));
  }
  return parsed;
}
