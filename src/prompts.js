// 提示词:注入当前日期 + 强制只输出 JSON + 合理时效。

const OUTPUT_RULE = `

【输出规则 · 必须严格遵守】完成搜索后,绝不要描述搜索过程,绝不要任何前言、说明、思考或道歉。直接只输出一个 JSON 对象,第一个字符必须是 {,最后一个字符必须是 }。即使信息不完整,也用已搜到的内容尽量填满条数;宁可少几项字段,也绝不返回纯文字说明。`;

export function sectionPrompt(kind, today) {
  if (kind === "fin") {
    return `今天是 ${today}。你是中国汽车行业财务分析助手。联网搜索中国主要上市车企(比亚迪、吉利汽车、长城汽车、长安汽车、理想汽车、赛力斯、小鹏、蔚来、上汽集团等)**最近一期已正式披露**的财报关键数据,选取 5 家。优先采用 2026 年的财报(如 2026Q1);若某公司尚未披露 2026 年数据,则用其 2025 年年报或最近一期季报。
JSON 格式:{"items":[{"company":"公司名","period":"报告期含年份,如2026Q1或2025年报","revenue":"营收带单位","revenue_yoy":"同比如+12.3%","profit":"归母净利润带单位","profit_yoy":"同比","points":["要点1","要点2","要点3"],"sources":[{"title":"来源名","url":"https真实链接"}]}]}
数据来自真实公开来源;url 真实可访问,不得编造;同比用 +/-;每个 point 不超过 28 字;period 必须标明年份。` + OUTPUT_RULE;
  }
  if (kind === "news") {
    return `今天是 ${today}。联网搜索中国汽车行业(以新能源为主)**最近几天**的热点新闻,按时间从新到旧选取 5 条最重要的(以最近 1-3 天为主;若当天消息不足,可纳入最近一周内的重要新闻)。返回你已找到的最新内容即可,不要因为凑不齐当天而放弃。
JSON 格式:{"date":"${today}","items":[{"title":"标题","summary":"两句以内客观摘要","source":"来源媒体","url":"https真实链接","time":"如今日或具体日期"}]}
url 必须真实可核查,不得编造。` + OUTPUT_RULE;
  }
  return `今天是 ${today}。联网搜索中国新能源汽车市场**最近一个月内**的新车上市、改款或预售动态,以及可获得的小定/大定/销量数据,优先最新,选取 5 款近期车型。返回你已找到的最新内容即可,不要因为时间不够新就放弃。
JSON 格式:{"items":[{"model":"车型名","brand":"品牌","status":"上市/改款/预售","date":"时间","price":"价格区间若有","orders":"小定/大定/销量数据若有并注明来源时间,无则填暂无公开数据","note":"一句话亮点不超过30字","sources":[{"title":"来源名","url":"https真实链接"}]}]}
数据来自真实来源;url 真实,不得编造。` + OUTPUT_RULE;
}

export function detailPrompt(kind, item, today) {
  const rule = " 只输出 JSON,不要任何前言或描述。";
  if (kind === "fin") {
    return `今天是 ${today}。联网搜索并撰写【${item.company} ${item.period}】财报要点分析,面向价值投资者,300-400 字,涵盖营收与利润表现、毛利率与盈利能力、销量与产品结构、现金流或负债、管理层指引或风险。输出 JSON:{"analysis":"分析正文","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。` + rule;
  }
  if (kind === "news") {
    return `今天是 ${today}。针对汽车行业新闻『${item.title}』,联网搜索补充背景、关键事实与行业影响,输出 JSON:{"analysis":"200-300字详情与影响分析","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。` + rule;
  }
  return `今天是 ${today}。联网搜索车型『${item.brand || ""} ${item.model}』最新的上市/改款详情:配置亮点、定价、订单(小定/大定)与销量、竞品对比。输出 JSON:{"analysis":"200-300字详情","sources":[{"title":"来源名","url":"https真实链接"}]}。url 必须真实。` + rule;
}
