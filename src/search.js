// 博查(Bocha)Web Search:为大模型提供干净的中文联网搜索结果。
import { fetchWithTimeout } from "./http.js";

let lastQuotaAt = 0;
/** 最近一次博查额度耗尽的时间(毫秒);0 表示未发生 */
export function searchQuotaState() { return { exhausted: lastQuotaAt > 0 && Date.now() - lastQuotaAt < 24 * 3600e3, at: lastQuotaAt || null }; }

export async function bochaSearch(query, { count = 8, freshness = "noLimit" } = {}) {
  const key = process.env.BOCHA_API_KEY;
  if (!key) throw new Error("未配置 BOCHA_API_KEY");
  const res = await fetchWithTimeout("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ query, count, freshness, summary: true })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // 额度/欠费单独标记,便于上层给出"去充值"的明确提示,而不是笼统的抓取失败
    if (/enough money|package quota/i.test(t)) {
      const e = new Error("博查搜索额度已用尽,请充值或续费套餐后再试");
      e.code = "QUOTA"; e.quota = true;
      lastQuotaAt = Date.now();
      throw e;
    }
    throw new Error(`Bocha ${res.status}: ${t.slice(0, 220)}`);
  }
  const data = await res.json();
  const root = data?.data || data;
  const arr = root?.webPages?.value || [];
  return arr.map((w) => ({ title: w.name, url: w.url, snippet: w.snippet, summary: w.summary, site: w.siteName, date: w.datePublished }));
}
