// 中低端智驾·AI 更新:抓三类情报(NOA下沉/纯视觉成本/国产芯片)→ 情报流 + 决策观点(草稿)。
import { research } from "./research.js";
import { setFeed, setOpinion } from "./ds_db.js";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const SCHEMA = `请基于下方资料,整理"中低端(15-20万及更低)智驾市场"的最新动向,聚焦三类:
① NOA下沉(城市/高速NOA进入更低价格带、某车型把高阶智驾下放)
② 纯视觉成本(去激光雷达路线、纯视觉行泊一体/NOA 的 BOM 与降本)
③ 行泊一体国产芯片(地平线/黑芝麻/爱芯/芯擎 等算力·量产·上车)
只用资料中真实出现的信息,不编造;每条给一句"对供给/竞争格局的洞察"。
JSON:{"feed":[{"kind":"noa|vis|chip","title":"标题","source":"来源媒体","url":"原文链接","date":"YYYY-MM-DD","insight":"一句洞察"}],
"opinion":"3-4句:当前城市/高速NOA的降本边界落在哪个价格带、谁在推动下沉、对高阶方案供应商意味着什么(可用**加粗**)"}`;

export async function updateDownshift() {
  const d = await research({
    queries: ["城市NOA 下沉 15万 智驾", "纯视觉 行泊一体 成本 方案", "地平线 征程6 黑芝麻 行泊一体 上车", "高阶智驾 下放 低价车型"],
    gnewsQueries: ["城市NOA 下沉 智驾", "纯视觉 智驾 成本", "地平线 黑芝麻 芯片 上车"],
    gnewsWhen: "30d", schema: SCHEMA, freshness: "oneMonth", count: 10, summaryLen: 600, maxTokens: 5000, model: MODEL,
  });
  const n = setFeed(Array.isArray(d.feed) ? d.feed : []);
  if (d.opinion && String(d.opinion).trim()) setOpinion(String(d.opinion).trim() + "\n\n_(AI 起草 · 请核对)_");
  console.log("[ds] feed+", n);
  return { feed: n, opinion: !!d.opinion };
}
