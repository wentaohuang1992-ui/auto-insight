// 存储洞察·AI 更新:抓 LPDDR/存储价格动向(优先 TrendForce 集邦、ChinaFlashMarket 闪存市场)→ 情报流 + 观点。
// 价格序列(合约/现货折线)以人工维护为主;AI 负责动向情报与趋势判断。
import { research } from "./research.js";
import { setFeed, setOpinion } from "./storage_db.js";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const SCHEMA = `请基于下方资料,整理移动内存(LPDDR4X / LPDDR5X 等)及存储市场的最新价格动向。只用资料中真实信息,不编造;尽量给出合约价/现货价方向、涨跌幅与时间。
来源优先级:TrendForce(集邦,标 source="tf")、ChinaFlashMarket 闪存市场(标 source="cfm")、其它新闻(source="gn")。
JSON:{"feed":[{"source":"tf|cfm|gn","title":"标题","url":"原文链接","date":"YYYY-MM-DD","insight":"一句:对 LPDDR4X/5X 合约价或现货价、供给的判断"}],
"opinion":"3-4句:当前 LPDDR4X/LPDDR5X 合约价与现货价走势、驱动因素(AI终端/HBM挤占/减产)、现货是否领先合约(先行信号),可用**加粗**"}`;

export async function updateStorage() {
  const d = await research({
    queries: ["LPDDR5X 价格 合约价 涨", "LPDDR4X 现货价 闪存市场", "TrendForce 移动内存 DRAM 价格 趋势", "存储 涨价 HBM 挤占 产能 2026"],
    gnewsQueries: ["LPDDR 内存 价格", "DRAM 合约价 涨", "存储芯片 涨价"],
    gnewsWhen: "30d", schema: SCHEMA, freshness: "oneMonth", count: 12, summaryLen: 650, maxTokens: 5000, model: MODEL,
  });
  const n = setFeed(Array.isArray(d.feed) ? d.feed : []);
  if (d.opinion && String(d.opinion).trim()) setOpinion(String(d.opinion).trim() + "\n\n_(AI 起草 · 请核对)_");
  console.log("[storage] feed+", n);
  return { feed: n, opinion: !!d.opinion };
}
