// 车企市场动态:免费 Google 实时新闻列表 + 每日缓存的 LLM 市场洞察小结。
// 新闻每次实时取(免费);小结按 品牌+日期 缓存,当天只生成一次,省 token。
import { googleNewsItems } from "./news_rss.js";
import { chatJSON } from "./llm.js";
import { getSnapshot, saveSnapshot } from "./db.js";
import { today } from "./dates.js";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

export async function brandMarket(brand) {
  const q = String(brand || "").trim();
  if (!q) return { brand: q, insight: "", news: [] };

  // 新闻:免费 Google 实时(近7天)
  let news = [];
  try { news = await googleNewsItems([`${q} 汽车`, `${q} 新车 销量`], "7d"); } catch (_) {}
  news = news.slice(0, 8);

  // 洞察小结:按 品牌+日期 缓存
  const { iso, cn } = today();
  const key = "binsight:" + q;
  let insight = "", insightDate = "";
  const cached = getSnapshot(key);
  if (cached && cached.payload && cached.payload.date === iso) {
    insight = cached.payload.insight; insightDate = cn;
  } else if (news.length) {
    const ctx = news.map((it, i) => `[${i + 1}] ${it.title} (${it.source || ""}, ${it.dateISO || ""})`).join("\n");
    try {
      const d = await chatJSON(`今天是 ${cn}。下面是【${q}】近期的新闻标题。请写一段 2-3 句的中文市场洞察小结,客观聚焦该品牌近期的销量、新品、价格、竞争或战略动向;只依据标题合理概括,不编造数字。JSON:{"insight":"..."}\n\n${ctx}`, 600);
      insight = (d && d.insight) || "";
      if (insight) { saveSnapshot(key, { date: iso, insight }); insightDate = cn; }
    } catch (e) { /* 小结失败不影响新闻列表 */ }
  }
  return { brand: q, insight, insightDate, news };
}
