// 数据任务层:财报 / 新闻 / 详情。博查搜索 + DeepSeek 整理。
import { research } from "./research.js";
import { today, recentIsos } from "./dates.js";
import { getDigest } from "./db.js";

const FIN_COMPANIES = ["比亚迪", "吉利汽车", "理想汽车", "赛力斯 问界", "长城汽车", "小鹏汽车"];

// —— 新闻去重辅助 ——
function normTitle(s) { return String(s || "").replace(/\s+/g, "").replace(/[【】\[\]()()·,、。!?:;""''""'']/g, "").toLowerCase(); }
function normUrl(u) { try { const x = new URL(u); return (x.host + x.pathname).toLowerCase(); } catch { return String(u || "").toLowerCase(); } }
function recentExclude(days) {
  const titles = []; const urls = new Set();
  for (const iso of recentIsos(days)) {
    const d = getDigest(iso);
    if (!d || !Array.isArray(d.items)) continue;
    for (const it of d.items) { if (it.title) titles.push(it.title); if (it.url) urls.add(it.url); }
  }
  return { titles, urls };
}
function dedupeNews(items, recent) {
  const seenT = new Set(recent.titles.map(normTitle));
  const seenU = new Set([...recent.urls].map(normUrl));
  const out = [];
  for (const it of (items || [])) {
    const t = normTitle(it.title), u = normUrl(it.url);
    if (!t) continue;
    if (seenT.has(t) || (u && seenU.has(u))) continue;
    seenT.add(t); if (u) seenU.add(u); out.push(it);
  }
  return out;
}

export async function getSection(kind) {
  const { cn } = today();
  if (kind === "fin") {
    const queries = FIN_COMPANIES.map((c) => `${c} 最新 季报 年报 营业收入 净利润 同比`);
    const schema = `今天是 ${cn}。请整理中国主要上市车企最近一期已正式披露的财报关键数据,选取 5 家。JSON:{"items":[{"company":"公司名","period":"报告期含年份,如2026Q1或2025年报","revenue":"营收带单位","revenue_yoy":"同比如+12.3%","profit":"归母净利润带单位","profit_yoy":"同比","points":["要点1","要点2","要点3"],"sources":[{"title":"来源名","url":"真实URL"}]}]}。同比用 +/-;period 必须标明年份;每个 point 不超过 28 字。`;
    return research({ queries, schema, freshness: "noLimit", count: 8, maxTokens: 4096 });
  }
  if (kind === "news") {
    const recent = recentExclude(3);
    const excludeText = recent.titles.length
      ? `\n\n以下新闻最近 3 天已经报道过,**请不要再包含**(同一事件换个说法也算重复):\n${recent.titles.slice(0, 40).map((t) => "- " + t).join("\n")}`
      : "";
    const queries = [
      `汽车 行业 新闻 ${cn}`,
      `新能源汽车 新车 发布 上市 ${cn}`,
      `车企 销量 ${cn}`,
      `汽车 行业 政策 新规 ${cn}`,
      `智能驾驶 自动驾驶 新闻 ${cn}`,
      `车企 财报 投资 合作 ${cn}`,
      `新能源汽车 出海 出口 ${cn}`
    ];
    const schema = `今天是 ${cn}。请整理中国汽车行业(以新能源为主)**最新**的重要新闻 10-12 条。严格要求:① 只选**当天和昨天(最近 2 天)**的新闻,按发布时间从新到旧排列;若最近 2 天确实不足 10 条,可适当往前补一两天,但越新越靠前、**绝不纳入一周以前的**;② 每条只列一次,不同来源报道的同一事件**合并为一条**;③ 用资料里的发布日期判断新旧。JSON:{"date":"${cn}","items":[{"title":"标题","summary":"两句以内客观摘要","source":"来源媒体","url":"真实URL","time":"发布日期如6月21日"}]}。${excludeText}`;
    const data = await research({ queries, schema, freshness: "oneWeek", count: 10, summaryLen: 400, maxTokens: 4096 });
    data.items = dedupeNews(data.items, recent);
    data.date = data.date || cn;
    return data;
  }
  throw new Error("未知板块:" + kind);
}

export async function getDetail(kind, item) {
  const { cn } = today();
  let queries, schema;
  if (kind === "fin") {
    queries = [`${item.company} ${item.period} 财报 营收 净利润 毛利率`, `${item.company} ${item.period} 业绩 销量 分析`];
    schema = `今天是 ${cn}。请据资料撰写【${item.company} ${item.period}】财报要点分析,面向价值投资者,300-400 字,涵盖营收与利润、毛利率与盈利能力、销量与产品结构、现金流或负债、管理层指引或风险。JSON:{"analysis":"分析正文","sources":[{"title":"来源名","url":"真实URL"}]}。`;
  } else if (kind === "news") {
    queries = [item.title, `${item.title} 背景 影响 分析`];
    schema = `今天是 ${cn}。请据资料就汽车行业新闻『${item.title}』补充背景、关键事实与行业影响。JSON:{"analysis":"200-300字详情与影响分析","sources":[{"title":"来源名","url":"真实URL"}]}。`;
  } else {
    queries = [`${item.brand || ""} ${item.model} 上市 配置 价格 小定 大定 销量`, `${item.brand || ""} ${item.model} 竞品 对比 评测`];
    schema = `今天是 ${cn}。请据资料整理车型『${item.brand || ""} ${item.model}』的上市/改款详情:配置亮点、定价、订单(小定/大定)与销量、竞品对比。JSON:{"analysis":"200-300字详情","sources":[{"title":"来源名","url":"真实URL"}]}。`;
  }
  return research({ queries, schema, freshness: "noLimit", count: 8, maxTokens: 2048 });
}
