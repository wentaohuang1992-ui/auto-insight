// 周报 / 月报(综合):把区间内已归档的「行业日报 + 今日要闻(新车/财务)」喂给 LLM 做汇总。
// 只用库里已有的存档,不再联网检索 —— 便宜、可复现,而且每条都能回溯到当天的日报。
import { chatJSON } from "./llm.js";
import { getDigest, digestIsoSet, headlinesInRange } from "./db.js";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cn = (s) => { const [y, m, d] = s.split("-"); return `${y}年${+m}月${+d}日`; };

/** 本周(周一)或上周一的 key;月报 key 为 M:YYYY-MM */
export function weekKeyOf(dateIso) {
  const d = new Date(dateIso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;               // 周一=0
  d.setDate(d.getDate() - dow);
  return "W:" + iso(d);
}
export function monthKeyOf(dateIso) { return "M:" + dateIso.slice(0, 7); }

/** key → {from,to,title,kind} */
export function rangeOf(key) {
  if (key.startsWith("W:")) {
    const from = key.slice(2), d = new Date(from + "T00:00:00");
    d.setDate(d.getDate() + 6);
    const to = iso(d);
    return { from, to, kind: "weekly", title: `周报 · ${cn(from)} – ${cn(to)}` };
  }
  const ym = key.slice(2), [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`, to = iso(new Date(y, m, 0));
  return { from, to, kind: "monthly", title: `月报 · ${y}年${m}月` };
}

/** 上一周期的 key(定时任务用:周一出上周、月初出上月) */
export function prevWeekKey(todayIso) {
  const d = new Date(weekKeyOf(todayIso).slice(2) + "T00:00:00");
  d.setDate(d.getDate() - 7);
  return "W:" + iso(d);
}
export function prevMonthKey(todayIso) {
  const [y, m] = todayIso.slice(0, 7).split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `M:${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// 收集区间内的素材:日报条目 + 两个要闻频道
function collect(from, to) {
  const src = { days: 0, news: [], launch: [], fin: [] };
  for (const d of digestIsoSet()) {
    if (d < from || d > to) continue;
    const p = getDigest(d);
    if (!p) continue;
    src.days++;
    for (const it of (p.items || [])) src.news.push({ d, t: it.title, s: it.summary || "", u: it.url || "" });
  }
  for (const { iso: d, channels } of headlinesInRange(from, to)) {
    for (const ch of ["launch", "fin"]) {
      for (const it of ((channels[ch] || {}).items || [])) src[ch].push({ d, t: it.title, s: it.summary || "", u: it.url || "" });
    }
  }
  return src;
}

const brief = (arr, cap) => arr.slice(0, cap).map((x) => `[${x.d}] ${x.t}｜${(x.s || "").slice(0, 90)}${x.u ? "｜" + x.u : ""}`).join("\n");

/**
 * 生成一份综合周报/月报。key: "W:YYYY-MM-DD" | "M:YYYY-MM"
 * 返回 {key,kind,title,range,overview,sections,watch,stats,generatedAt}
 */
export async function genReport(key) {
  const { from, to, kind, title } = rangeOf(key);
  const src = collect(from, to);
  const total = src.news.length + src.launch.length + src.fin.length;
  if (!total) throw new Error(`区间 ${from} ~ ${to} 没有已归档的日报或要闻,无法生成${kind === "weekly" ? "周报" : "月报"}`);

  const label = kind === "weekly" ? "周报" : "月报";
  const prompt = `你是资深汽车行业分析师。下面是 ${from} 至 ${to} 期间本站已归档的行业动态、新车上市与财务融资资讯。
请写一份**综合${label}**:把散落的每日信息归纳成脉络,指出趋势与变化,而不是罗列新闻。

要求:
① overview:200-300 字的整体综述,点出本期最重要的 2-3 条主线;
② sections:分 3-5 个主题板块(如 政策与市场、新车与订单、销量与竞争格局、财务与融资、供应链与成本),每个板块给 title + 一段 150 字左右的 body(要有归纳和因果,不要复述标题)+ 3-5 条 points 要点;
③ watch:3-5 条「下期关注」,写具体可验证的观察点;
④ 只使用下方资料中出现的事实,不要引入资料之外的数字或事件;数字务必与资料一致,拿不准就不写。

只输出 JSON,不要任何解释或代码块标记:
{"overview":"...","sections":[{"title":"...","body":"...","points":["...","..."]}],"watch":["...","..."]}

【行业动态】(共 ${src.news.length} 条)
${brief(src.news, 120)}

【新车上市 · 订单 · 口碑】(共 ${src.launch.length} 条)
${brief(src.launch, 60)}

【财务 · 融资】(共 ${src.fin.length} 条)
${brief(src.fin, 60)}`;

  const data = await chatJSON(prompt, 6000);
  return {
    key, kind, title, range: `${from} ~ ${to}`,
    overview: data.overview || "",
    sections: Array.isArray(data.sections) ? data.sections : [],
    watch: Array.isArray(data.watch) ? data.watch : [],
    stats: { days: src.days, news: src.news.length, launch: src.launch.length, fin: src.fin.length },
    generatedAt: new Date().toISOString(),
  };
}
