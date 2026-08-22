// 博查(Bocha)Web Search:为大模型提供干净的中文联网搜索结果。
import { fetchWithTimeout } from "./http.js";

export async function bochaSearch(query, { count = 8, freshness = "noLimit" } = {}) {
  const key = process.env.BOCHA_API_KEY;
  if (!key) throw new Error("未配置 BOCHA_API_KEY");
  const res = await fetchWithTimeout("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ query, count, freshness, summary: true })
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Bocha ${res.status}: ${t.slice(0, 220)}`); }
  const data = await res.json();
  const root = data?.data || data;
  const arr = root?.webPages?.value || [];
  return arr.map((w) => ({ title: w.name, url: w.url, snippet: w.snippet, summary: w.summary, site: w.siteName, date: w.datePublished }));
}
