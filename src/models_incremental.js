// 增量更新:从当天日报新闻里抽取"具体车型的明确变化",字段级合并入库(几乎不额外花 token)。
import { chatJSON } from "./llm.js";
import { mergeModel } from "./models_db.js";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

export async function updateFromNews(newsData) {
  const items = (newsData && Array.isArray(newsData.items)) ? newsData.items : [];
  if (!items.length) return { from: 0, applied: 0 };
  const ctx = items.map((it, i) => `[${i + 1}] ${it.title || ""}\n摘要: ${String(it.summary || "").slice(0, 200)}\nURL: ${it.url || ""}`).join("\n\n");
  const prompt = `下面是今天的中国汽车行业新闻。请只提取其中**对具体车型的明确变化**(新车上市、改款上市、价格调整、智驾/配置重大变化、状态变化如开启预售/正式上市),严格依据新闻明说的内容,不要推测、不要泛泛而谈。每条:
{brand:品牌, model:车型名(尽量规范完整), body:轿车/SUV/MPV(若提及), priceFrom:起售价数字万(若新闻给了定价/调价), priceRange:价格区间(若提及), adas:智驾系统(若提及), hi:是否搭载华为乾崑(true/false,仅在明确时给), status:状态(若提及如"上市"/"预售"), launch:{kind:"新车"或"改款", month:1-12, date:"如3月", note:"亮点20字内"}(仅当是上市/改款时给), note:"一句话(30字内)", source:{title:"来源标题",url:"该新闻的真实URL"}}
没有任何明确的具体车型变化时,返回 {"deltas":[]}。不要编造品牌或车型,source.url 必须取自上面对应新闻的 URL。
JSON:{"deltas":[{"brand":"","model":"","status":"","launch":{"kind":"新车","month":6,"date":"6月","note":""},"source":{"title":"","url":""}}]}

新闻:
${ctx}`;
  let data;
  try { data = await chatJSON(prompt, 2048); } catch (e) { console.error("[incremental] 抽取失败", e.message); return { from: items.length, applied: 0, error: e.message }; }
  const deltas = (data && Array.isArray(data.deltas)) ? data.deltas : [];
  let applied = 0; const log = [];
  for (const d of deltas) {
    const r = mergeModel(d);
    if (r.created || r.updated) { applied++; log.push(`${r.created ? "新增" : "更新"} ${d.brand} ${d.model}`); }
  }
  if (log.length) console.log("[incremental]", log.join(" / "));
  return { from: items.length, deltas: deltas.length, applied, log };
}
