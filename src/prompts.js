// 提示词:注入当前日期,强制返回最新数据;返回带真实链接的 JSON。

export function sectionPrompt(kind, today) {
  if (kind === "fin") {
    return `今天是 ${today}。你是中国汽车行业财务分析助手。联网搜索中国主要上市车企(比亚迪、吉利汽车、长城汽车、长安汽车、理想汽车、赛力斯、小鹏、蔚来、上汽集团等)**最近一期已正式披露**的财报关键数据,选取 5 家。优先采用 2026 年的财报(如 2026Q1);若某公司尚未披露 2026 年数据,则用其 2025 年年报或最近一期季报。完成后只输出一个 JSON 对象,不要任何额外文字或 Markdown:
{"items":[{"company":"公司名","period":"报告期含年份,如2026Q1或2025年报","revenue":"营收带单位","revenue_yoy":"同比如+12.3%","profit":"归母净利润带单位","profit_yoy":"同比","points":["要点1","要点2","要点3"],"sources":[{"title":"来源名","url":"https真实链接"}]}]}
要求:数据来自真实公开来源;url 真实可访问,不得编造;同比用 +/-;每个 point 不超过 28 字;period 必须标明年份。`;
  }
  if (kind === "news") {
    return `今天是 ${today}。联网搜索中国汽车行业(以新能源为主)**最近 1-2 天**的热点新闻,选取 5 条最重要的。务必是最新消息,忽略较早的旧闻。完成后只输出一个 JSON 对象,不要任何额外文字或 Markdown:
{"date":"${today}","items":[{"title":"标题","summary":"两句以内客观摘要","source":"来源媒体","url":"https真实链接","time":"如今日或具体日期"}]}
url 必须真实可核查,不得编造。`;
  }
  return `今天是 ${today}。联网搜索中国新能源汽车市场**最近 2-3 周**的新车上市、改款或预售动态,以及可获得的小定/大定/销量数据,选取 5 款近期车型。务必是最新动态,不要返回过时信息。完成后只输出一个 JSON 对象,不要任何额外文字或 Markdown:
{"items":[{"model":"车型名","brand":"品牌","status":"上市/改款/预售","date":"时间","price":"价格区间若有","orders":"小定/大定/销量数据若有并注明来源时间,无则填暂无公开数据","note":"一句话亮点不超过30字","sources":[{"title":"来源名","url":"https真实链接"}]}]}
数据来自真实来源;url 真实,不得编造。`;
}

export function detailPrompt(kind, item, today) {
  if (kind === "fin") {
    return `今天是 ${today}。联网搜索并撰写【${item.company} ${item.period}】财报要点分析,面向价值投资者,300-400 字,涵盖营收与利润表现、毛利率与盈利能力、销量与产品结构、现金流或负债、管理层指引或风险。只输出 JSON:{"analysis":"分析正文","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。`;
  }
  if (kind === "news") {
    return `今天是 ${today}。针对汽车行业新闻『${item.title}』,联网搜索补充背景、关键事实与行业影响,只输出 JSON:{"analysis":"200-300字详情与影响分析","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。`;
  }
  return `今天是 ${today}。联网搜索车型『${item.brand || ""} ${item.model}』最新的上市/改款详情:配置亮点、定价、订单(小定/大定)与销量、竞品对比。只输出 JSON:{"analysis":"200-300字详情","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。`;
}
