// 存储洞察:存储芯片(DRAM/NAND/LPDDR/UFS/eMMC)涨价及对汽车行业影响。
// 博查搜「报道+研报+价格数据」→ DeepSeek 整理成 概览 + 价格风向标 + 卡片列表。
import { research } from "./research.js";
import { today } from "./dates.js";

export async function getStorage() {
  const { cn } = today();
  const queries = [
    `存储芯片 涨价 DRAM NAND 价格 ${cn}`,
    `内存 闪存 涨价 原因 AI 需求 2026`,
    `存储 涨价 汽车 智能座舱 智驾 域控 成本 影响`,
    `存储芯片 涨价 研报 券商 分析`,
    `DRAM NAND 合约价 现货价 涨幅 2026`,
    `车规级 存储 eMMC UFS LPDDR 涨价 缺货`,
    `存储原厂 三星 美光 SK海力士 长江存储 减产 涨价`
  ];
  const schema = `今天是 ${cn}。主题:存储芯片(DRAM/NAND/LPDDR/UFS/eMMC 等内存与闪存)近期大幅涨价,及其对中国汽车行业(智能座舱、智驾域控等)的影响。请据资料整理为以下 JSON:
{
"overview":"一段话(120字内):当前存储涨价态势 + 对汽车行业的影响",
"prices":[{"name":"品类,如 DRAM(DDR5)/NAND Flash/LPDDR5/车规级UFS","change":"涨跌幅,如 +20% 或 环比上涨","level":"当前价格或价格指数,无则留空","period":"时间/区间,如 2026Q2环比","note":"一句话补充,无则留空","source":{"title":"来源名","url":"真实URL"}}],
"items":[{"title":"标题","type":"新闻/研报/数据 三选一","source":"来源媒体或机构","date":"发布日期","summary":"两句以内客观摘要","url":"真实URL"}]
}
要求:prices 给 4-8 个关键品类(优先与汽车相关的车规级、LPDDR、UFS);items 收集相关报道与研报约 10 条,按时间从新到旧;type 只能是"新闻""研报""数据";url 必须取自资料中真实出现的链接。`;
  return research({ queries, schema, freshness: "oneMonth", count: 10, summaryLen: 500, maxTokens: 5000 });
}
