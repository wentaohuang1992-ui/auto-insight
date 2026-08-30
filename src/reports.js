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

/** 某周(以周一为准)属于当月第几周:按周一所在月份计算 */
export function weekOfMonth(mondayIso) {
  const d = new Date(mondayIso + "T00:00:00");
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const firstMon = new Date(first);
  firstMon.setDate(1 + ((8 - (first.getDay() || 7)) % 7));   // 该月第一个周一
  const n = Math.floor((d - firstMon) / 6048e5) + 1;
  return { year: y, month: m + 1, week: n < 1 ? 1 : n };
}

/** key → {from,to,title,kind} */
export function rangeOf(key) {
  if (key.startsWith("W:")) {
    const from = key.slice(2), d = new Date(from + "T00:00:00");
    d.setDate(d.getDate() + 6);
    const to = iso(d);
    const w = weekOfMonth(from);
    return { from, to, kind: "weekly", title: `${w.year}年${w.month}月 第${w.week}周 · 周报` };
  }
  const ym = key.slice(2), [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`, to = iso(new Date(y, m, 0));
  return { from, to, kind: "monthly", title: `${y}年${m}月 · 月报` };
}

/** 列出某年某月包含的所有周(以周一归属月份为准),供前端三级选择 */
export function weeksOfMonth(year, month) {
  const first = new Date(year, month - 1, 1);
  const d = new Date(first);
  d.setDate(1 + ((8 - (first.getDay() || 7)) % 7));      // 该月第一个周一
  const out = [];
  while (d.getMonth() === month - 1) {
    const from = iso(d), e = new Date(d); e.setDate(e.getDate() + 6);
    out.push({ key: "W:" + from, week: out.length + 1, from, to: iso(e) });
    d.setDate(d.getDate() + 7);
  }
  return out;
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

const brief = (arr, cap, off) => arr.slice(0, cap).map((x, i) => `#${off + i} [${x.d}] ${x.t}｜${(x.s || "").slice(0, 90)}`).join("\n");

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
  const all = [...src.news, ...src.launch, ...src.fin];   // 统一编号,供 LLM 引用
  const nNews = Math.min(src.news.length, 120), nLaunch = Math.min(src.launch.length, 60), nFin = Math.min(src.fin.length, 60);
  const idx = [...src.news.slice(0, 120), ...src.launch.slice(0, 60), ...src.fin.slice(0, 60)];
  const prompt = `你是资深汽车行业分析师。下面是 ${from} 至 ${to} 期间本站已归档的行业动态、新车上市与财务融资资讯,每条前面有编号 #N。
请写一份**综合${label}**:把散落的每日信息归纳成脉络,指出趋势与变化,而不是罗列新闻。

要求:
① overview:200-300 字的整体综述,点出本期最重要的 2-3 条主线;
② sections:分 3-5 个主题板块(如 政策与市场、新车与订单、销量与竞争格局、财务与融资、供应链与成本),每个板块给 title + 一段 150 字左右的 body(要有归纳和因果,不要复述标题)+ 3-5 条 points;
③ **每条 point 写成对象** {"t":"要点文字","refs":[编号,编号]},refs 填该要点依据的资料编号(1-3 个,必须是上面出现过的 #N 数字);
④ watch:3-5 条「下期关注」,写具体可验证的观察点(纯文字数组);
⑤ 只使用下方资料中出现的事实,不要引入资料之外的数字或事件;**不要自己写网址**,只写编号。

只输出 JSON,不要任何解释或代码块标记:
{"overview":"...","sections":[{"title":"...","body":"...","points":[{"t":"...","refs":[1,5]}]}],"watch":["...","..."]}

【行业动态】
${brief(src.news, 120, 1)}

【新车上市 · 订单 · 口碑】
${brief(src.launch, 60, 1 + nNews)}

【财务 · 融资】
${brief(src.fin, 60, 1 + nNews + nLaunch)}`;

  const data = await chatJSON(prompt, 6000);
  // 把 refs 编号映射回真实链接(LLM 不碰 URL,杜绝编造)
  const link = (n) => { const it = idx[Number(n) - 1]; return it && it.u ? { title: it.t, url: it.u, date: it.d } : null; };
  const sections = (Array.isArray(data.sections) ? data.sections : []).map((s) => ({
    title: s.title || "",
    body: s.body || "",
    points: (s.points || []).map((p) => {
      if (typeof p === "string") return { t: p, links: [] };
      return { t: p.t || "", links: (p.refs || []).map(link).filter(Boolean).slice(0, 3) };
    }),
  }));
  return {
    key, kind, title, range: `${from} ~ ${to}`,
    overview: data.overview || "",
    sections,
    watch: Array.isArray(data.watch) ? data.watch : [],
    stats: { days: src.days, news: src.news.length, launch: src.launch.length, fin: src.fin.length },
    generatedAt: new Date().toISOString(),
  };
}
