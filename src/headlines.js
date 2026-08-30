// 「今日要闻」多频道:新车上市·销量 / 财务·融资。复用 research()(博查+Google News 检索 → LLM 汇总)。
// 格式与行业信息速递一致(items 列表),但按频道聚焦。每日生成,存最新一份(见 db.js saveHeadlines)。
import { research } from "./research.js";
import { today } from "./dates.js";

const CH = {
  launch: {
    label: "新车上市 · 订单 · 口碑",
    focus: "新车/改款上市与预售、定价、订单(小定/大定数量)、上市后交付与月度销量、市场评价与用户口碑(评测、大定转化、退订、对比竞品)",
    queries: ["新能源汽车 新车 上市 发布 定价", "新车 预售 小定 大定 订单 数量", "新车 上市 首月 销量 交付 爬坡", "新车 上市 市场 评价 口碑 评测", "热门 车型 大定 退订 竞品 对比"],
    gnews: ["新车 上市 大定 小定", "新车 交付 销量", "新车 评测 口碑"],
  },
  fin: {
    label: "财务 · 融资",
    focus: "上市车企财报/业绩预告、融资(定增/发债/IPO/战略投资)、投资并购与股权合作、供应链账期与现金流",
    queries: ["车企 财报 营收 净利润 业绩", "车企 融资 定增 发债 IPO", "汽车 上市公司 业绩预告 半年报", "车企 投资 并购 战略合作 股权", "汽车 供应链 账期 现金流"],
    gnews: ["车企 财报 业绩", "车企 融资 定增 IPO", "汽车 投资 并购"],
  },
};

export function headlineChannels() { return Object.keys(CH); }

export async function genHeadlines(channel) {
  const c = CH[channel];
  if (!c) throw new Error("未知要闻频道:" + channel);
  const { cn, iso } = today();
  const extra = channel === "launch"
    ? "每条摘要请尽量点出:定价、订单(小定/大定具体数量)、首月/月度销量或交付、市场评价与口碑(评测结论、大定转化或退订、与竞品对比)——资料里有就写、没有不编。"
    : "";
  const schema = `今天是 ${cn}。请基于下方资料整理中国汽车行业「${c.label}」方向的今日要闻,聚焦:${c.focus}。要求:① 只选最近 2-3 天发布的新闻,按发布时间从新到旧;② 同一事件只列一次,合并重复;③ 给 8-12 条,每条配一段 2-3 句的客观摘要 summary;④ url 必须取自资料中真实出现的链接,不可编造。${extra} JSON:{"date":"${cn}","items":[{"title":"标题","summary":"2-3句客观摘要","source":"来源媒体","url":"真实URL","time":"发布日期如8月28日"}]}`;
  const data = await research({ queries: c.queries, schema, gnewsQueries: c.gnews, gnewsWhen: "", freshness: "oneWeek", count: 8, maxTokens: 6000 });
  const items = (data && Array.isArray(data.items)) ? data.items : [];
  return { date: (data && data.date) || cn, iso, channel, label: c.label, items, generatedAt: new Date().toISOString() };
}
