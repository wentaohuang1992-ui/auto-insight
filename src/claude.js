// 数据任务层:财报 / 新闻 / 详情。博查搜索 + Google News 实时源 + DeepSeek 整理。
import { research } from "./research.js";
import { bochaSearch } from "./search.js";
import { chatJSON } from "./llm.js";
import { googleNewsItems } from "./news_rss.js";
import { today, recentIsos, isosBefore } from "./dates.js";
import { getDigest } from "./db.js";
import { pool } from "./pool.js";

const FIN_COMPANIES = ["比亚迪", "吉利汽车", "理想汽车", "赛力斯 问界", "长城汽车", "小鹏汽车"];

// —— 新闻去重辅助 ——
function normTitle(s) { return String(s || "").replace(/\s+/g, "").replace(/[【】\[\]()()·,、。!?:;""''""'']/g, "").toLowerCase(); }
function normUrl(u) { try { const x = new URL(u); return (x.host + x.pathname).toLowerCase(); } catch { return String(u || "").toLowerCase(); } }
// 取 baseIso 之前 days 天已发过的标题/链接,用于跨天去重。
// baseIso 传空就是今天;补漏历史某天时要以那天为基准,否则会拿今天的前几天去去重。
function recentExclude(days, baseIso) {
  const titles = []; const urls = new Set();
  for (const iso of (baseIso ? isosBefore(baseIso, days) : recentIsos(days))) {
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

// 用真实来源发布日期(Google News pubDate)覆盖模型自填的 time,并滤掉明显过旧的条目。
// 模型没找到日期时常错用当天,导致旧闻显示成今天;这里按 URL 回填真日期、超 14 天的丢弃。
function stampDates(items, gnews, backfill) {
  const byUrl = new Map();
  for (const g of (gnews || [])) if (g.url && g.dateISO) byUrl.set(normUrl(g.url), g.dateISO);
  const fmtCn = (iso) => { const m = String(iso || "").match(/^\d{4}-(\d{2})-(\d{2})$/); return m ? `${+m[1]}月${+m[2]}日` : ""; };
  const now = Date.now();
  const out = [];
  for (const it of (items || [])) {
    const iso = byUrl.get(normUrl(it.url));
    if (iso) {
      const cn = fmtCn(iso); if (cn) it.time = cn;
      if (!backfill) { const ageDays = (now - new Date(iso).getTime()) / 864e5; if (ageDays > 14) continue; } // 明显旧闻丢弃
    }
    out.push(it);
  }
  return out;
}

async function bochaFresh(q, backfill = false) {
  // 补漏时目标日期已过去若干天,"近一天"必定搜不到,直接用更宽的窗口。
  if (backfill) {
    try { return await bochaSearch(q, { count: 6, freshness: "oneMonth" }); } catch (_) { return []; }
  }
  try { const r = await bochaSearch(q, { count: 6, freshness: "oneDay" }); if (r.length) return r; } catch (_) {}
  try { return await bochaSearch(q, { count: 6, freshness: "oneWeek" }); } catch (_) { return []; }
}

/**
 * 生成一天的日报。
 * @param {object} [opts]
 * @param {string} [opts.targetIso] 目标日期;补漏历史某天时传,默认今天
 * @param {string} [opts.targetCn]  目标日期的中文写法
 * @param {boolean} [opts.backfill] 补漏模式:检索窗口放宽,并要求模型围绕目标日期挑新闻
 *
 * 补漏的固有局限:检索接口只能搜"现在能搜到的",补 3 周前的日报拿不回那天的实时流。
 * 这里能做的是把检索窗口放宽到一个月、并在提示里锁定目标日期让模型自己筛,
 * 结果质量必然不如当天生成 —— 所以补出来的日报会被标记 source=backfill,不与正常日报混同。
 */
async function getNews(opts = {}) {
  const backfill = Boolean(opts.backfill);
  const cn = opts.targetCn || today().cn;
  const recent = recentExclude(3, opts.targetIso);
  const excludeText = recent.titles.length
    ? `\n\n以下新闻最近 3 天已报道过,**请不要再包含**(同一事件换说法也算):\n${recent.titles.slice(0, 25).map((t) => "- " + t).join("\n")}`
    : "";

  // A:博查(去掉日期、近1天优先)
  const bochaQs = ["汽车 行业 新闻", "新能源汽车 新车 发布 上市", "车企 销量", "汽车 行业 政策 新规", "智能驾驶 自动驾驶", "车企 财报 投资 合作", "新能源汽车 出海 出口"];

  // A、B 两路并发跑,内部各自限流;此前 7 次博查 + 5 次 Google 全串行,一次日报要等十几秒。
  const [bochaBlocksRaw, gnews] = await Promise.all([
    pool(bochaQs, 4, async (q) => {
      const rs = await bochaFresh(q, backfill);
      if (!rs.length) return null;
      return `### 博查搜索:${q}\n` + rs.map((r, i) => `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, 220)}`).join("\n\n");
    }),
    // Google News RSS 只有最近两天,补历史日期时它给不出目标日那天的东西,
    // 拉回来只会把"今天的新闻"混进目标日的日报里 —— 所以补漏时整路跳过。
    backfill
      ? Promise.resolve([])
      : googleNewsItems(["中国 新能源汽车", "新能源汽车 上市 发布", "车企 销量", "智能驾驶 汽车", "汽车 行业 政策"]).catch(() => []),
  ]);
  const bochaBlocks = bochaBlocksRaw.filter(Boolean);
  const gnBlock = gnews.length
    ? "### 实时新闻(Google News,最近2天,发布时间最准,请优先采用)\n" + gnews.slice(0, 25).map((it, i) => `[G${i + 1}] ${it.title} | ${it.source || ""} | ${it.dateISO || it.date || ""}\nURL: ${it.url}`).join("\n\n")
    : "";

  const ctx = [gnBlock, ...bochaBlocks].filter(Boolean).join("\n\n");
  const itemsDateRule = backfill
    ? `**只选 ${cn} 当天或前一天发布的新闻**,按发布时间从新到旧;资料里晚于 ${cn} 的一律不要,凑不够条数就少给`
    : `**只选最近 2 天(当天/昨天)**,按发布时间从新到旧,优先采用"实时新闻"里时间最新的;不足 10 条才往前补一两天,绝不纳入一周前的`;
  const head = backfill
    ? `请整理 ${cn}(一个已经过去的日期)当天的中国汽车行业(以新能源为主)日报。注意:下方资料是现在检索到的,里面混有 ${cn} 之后的新闻,**一律不要采用**;宁可少给几条,也不要拿更晚的新闻凑数。输出三部分:`
    : `今天是 ${cn}。请基于下方资料整理中国汽车行业(以新能源为主)的当日日报,输出三部分:`;
  const prompt = `${head}
A. overview:一段话(150字以内)综述当天行业各类新鲜事(可涉及新车、销量、政策、技术、资本等)。
B. highlights:分类要点。从 新车 / 销量 / 政策 / 技术 / 资本 这几类里,**只列当天确有内容的类别**(没有的不列),每类给 cat 和一两句 text。
C. items:重要新闻 ${backfill ? "尽量 8-12 条(宁缺毋滥)" : "10-12 条"}。严格要求:① ${itemsDateRule};② 每条只列一次,同一事件合并;③ **每条配一段话(2-4 句)客观摘要 summary**(结合博查资料;只有标题的就据标题合理概括);④ url 取自资料中真实出现的链接。
JSON:{"date":"${cn}","overview":"一段话综述","highlights":[{"cat":"新车","text":"一两句"}],"items":[{"title":"标题","summary":"一段话2-4句摘要","source":"来源媒体","url":"真实URL","time":"发布日期如6月21日"}]}。${excludeText}

资料如下:
${ctx || "(暂无搜索结果)"}`;

  const data = await chatJSON(prompt, 7000);
  data.items = stampDates(dedupeNews(data.items, recent), gnews, backfill);
  data.date = data.date || cn;
  return data;
}

export async function getSection(kind, opts = {}) {
  const { cn } = today();
  if (kind === "fin") {
    const queries = FIN_COMPANIES.map((c) => `${c} 最新 季报 年报 营业收入 净利润 同比`);
    const schema = `今天是 ${cn}。请整理中国主要上市车企最近一期已正式披露的财报关键数据,选取 5 家。JSON:{"items":[{"company":"公司名","period":"报告期含年份,如2026Q1或2025年报","revenue":"营收带单位","revenue_yoy":"同比如+12.3%","profit":"归母净利润带单位","profit_yoy":"同比","points":["要点1","要点2","要点3"],"sources":[{"title":"来源名","url":"真实URL"}]}]}。同比用 +/-;period 必须标明年份;每个 point 不超过 28 字。`;
    return research({ queries, schema, freshness: "noLimit", count: 8, maxTokens: 4096 });
  }
  if (kind === "news") return getNews(opts);
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
