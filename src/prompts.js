// 三大板块 + 详情 的提示词。联网检索由服务端 web_search 工具完成,要求返回带真实链接的 JSON。

export const SECTION_PROMPTS = {
  fin: `你是中国汽车行业财务分析助手。联网搜索中国主要上市车企(比亚迪、吉利汽车、长城汽车、长安汽车、理想汽车、赛力斯、小鹏、蔚来、上汽集团等)最新公开披露的季报或年报关键数据,选取 5 家有较新财报的车企。完成后只输出一个 JSON 对象,不要任何额外文字或 Markdown 代码块:
{"items":[{"company":"公司名","period":"报告期如2025Q3","revenue":"营收带单位","revenue_yoy":"同比如+12.3%","profit":"归母净利润带单位","profit_yoy":"同比","points":["要点1","要点2","要点3"],"sources":[{"title":"来源名","url":"https真实链接"}]}]}
要求:数据必须来自搜索到的真实公开来源;url 必须是真实可访问链接,不得编造;同比用 +/- 表示;每个 point 不超过 28 字。`,

  news: `联网搜索最近 24-48 小时中国汽车行业(以新能源为主)的热点新闻,选取 5 条最重要的。完成后只输出一个 JSON 对象,不要任何额外文字或 Markdown:
{"date":"YYYY年M月D日","items":[{"title":"标题","summary":"两句以内客观摘要","source":"来源媒体","url":"https真实链接","time":"如今日或6月16日"}]}
要求:url 必须真实可核查,不得编造;摘要客观精简。`,

  launch: `联网搜索最近中国新能源汽车市场的新车上市、改款或预售动态,以及可获得的小定/大定/销量数据,选取 5 款近期车型。完成后只输出一个 JSON 对象,不要任何额外文字或 Markdown:
{"items":[{"model":"车型名","brand":"品牌","status":"上市/改款/预售","date":"时间","price":"价格区间若有","orders":"小定/大定/销量数据若有并注明来源时间,无则填暂无公开数据","note":"一句话亮点不超过30字","sources":[{"title":"来源名","url":"https真实链接"}]}]}
要求:数据须来自真实来源;url 必须真实,不得编造。`
};

export function detailPrompt(kind, item) {
  if (kind === "fin") {
    return `联网搜索并撰写【${item.company} ${item.period}】财报要点分析,面向价值投资者,300-400 字,涵盖:营收与利润表现、毛利率与盈利能力、销量与产品结构、现金流或负债、管理层指引或风险。完成后只输出 JSON:{"analysis":"分析正文","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实,不得编造。`;
  }
  if (kind === "news") {
    return `针对汽车行业新闻『${item.title}』,联网搜索补充背景、关键事实与行业影响,只输出 JSON:{"analysis":"200-300字详情与影响分析","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。`;
  }
  return `联网搜索车型『${item.brand || ""} ${item.model}』的上市/改款详情:配置亮点、定价、订单(小定/大定)与销量、竞品对比。只输出 JSON:{"analysis":"200-300字详情","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。`;
}
