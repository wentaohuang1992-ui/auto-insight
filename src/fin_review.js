// 财报解读:一键「自动抓数据 → 算指标与信号 → 生成结构化解读」。
//
// 流水线（每一步失败都不致命，会在结果里如实说明走到哪一步）：
//
//   ① 抓数据   A 股走 fin_em、港股走 fin_hk，抓完就落库（manual:false，不覆盖手改）
//   ② 算事实   纯 JS 计算：派生指标、环比同比、11 条风险信号。**这一层不碰大模型**
//   ③ 写解读   DeepSeek 只负责把算好的事实串成人话，不许自己产生数字
//   ④ 数字校验 解读正文里出现的每个数字都必须能在事实里找到，找不到就判幻觉、重试
//   ⑤ 落库     存进 financials.json 的 reviews
//
// 为什么要分这么清楚：数据是靠算的，叙述才是靠模型的。
// 让模型自己去"看财报写解读"，它会把数字算错、把季度记混、把口径搞反——
// 而这些错误在一段通顺的中文里几乎看不出来。
//
// 视角：这个站是**供应商视角**的客户洞察（前端三个主题是现金流与还款风险 / 库存压力 /
// 研发与自研部件）。所以解读的落点不是"这家公司好不好"，而是
// "这家客户还付不付得起款、会不会压我们价、会不会把我们的件自研掉"。
import { listCompanies, getAll, upsertReview, slug } from "./fin_db.js";
import { seedCompanyEM, pickAShare } from "./fin_em.js";
import { seedCompanyHK, pickHK } from "./fin_hk.js";
import { chatJSON } from "./llm.js";

const r1 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
const pct = (a, b) => { const v = div(a, b); return v == null ? null : r1(v * 100); };
const yoyPct = (cur, prev) => (cur == null || prev == null || prev === 0 ? null : r1((cur / prev - 1) * 100));

// ---------------------------------------------------------------------
// ① 抓数据
// ---------------------------------------------------------------------
async function refetch(company) {
  const steps = [];
  if (pickAShare(company.ticker)) {
    try { const r = await seedCompanyEM(company.name, { save: true }); steps.push({ source: "东方财富A股", ok: true, saved: r.saved, quarters: r.quarters }); }
    catch (e) { steps.push({ source: "东方财富A股", ok: false, error: e.message }); }
  } else if (pickHK(company.ticker)) {
    try { const r = await seedCompanyHK(company.name, { save: true }); steps.push({ source: "东方财富港股", ok: true, saved: r.saved, quarters: r.quarters, warn: r.warn }); }
    catch (e) { steps.push({ source: "东方财富港股", ok: false, error: e.message }); }
  } else {
    steps.push({ source: "无结构化源", ok: false, error: "该车企没有 A 股/港股代码,只能用「AI抓取」或手工录入" });
  }
  return steps;
}

// ---------------------------------------------------------------------
// ② 算事实：派生指标
// ---------------------------------------------------------------------
function metricsOf(q) {
  if (!q) return null;
  const gross = q.revenue != null && q.operatingCost != null ? q.revenue - q.operatingCost : null;
  const debt = (q.stDebt || 0) + (q.ltDebt || 0);
  return {
    期间: `${q.year}Q${q.q}`,
    营业收入亿: r2(q.revenue), 归母净利亿: r2(q.netProfit), 扣非归母亿: r2(q.netProfitEx),
    毛利亿: r2(gross), 毛利率: pct(gross, q.revenue), 净利率: pct(q.netProfit, q.revenue),
    研发费用亿: r2(q.rdSpend), 研发费率: pct(q.rdSpend, q.revenue),
    经营现金流亿: r2(q.ocf),
    利润含金量: q.netProfit > 0 ? r2(div(q.ocf, q.netProfit)) : null,
    存货亿: r2(q.inventory),
    存货周转天数: q.operatingCost > 0 ? r1(div(q.inventory, q.operatingCost) * 90) : null,
    应付账款及票据亿: r2(q.ap),
    应付周转天数: q.operatingCost > 0 ? r1(div(q.ap, q.operatingCost) * 90) : null,
    货币资金亿: r2(q.cash),
    有息负债亿: debt ? r2(debt) : null,
    现金覆盖应付: q.ap > 0 ? r2(div(q.cash, q.ap)) : null,
    现金覆盖刚性支出: (q.ap || debt) ? r2(div(q.cash, (q.ap || 0) + debt)) : null,
    资产负债率: pct(q.totalLiab, q.totalAssets),
    销量辆: q.sales ?? null,
    单车营收万: q.sales > 0 ? r2(div(q.revenue, q.sales) * 10000) : null,
    单车净利元: q.sales > 0 ? Math.round(div(q.netProfit, q.sales) * 1e8) : null,
    单车研发元: q.sales > 0 && q.rdSpend != null ? Math.round(div(q.rdSpend, q.sales) * 1e8) : null,
    政府补助亿: r2(q.govGrant), 合联营投资收益亿: r2(q.jvIncome),
    海外收入占比: q.overseasPct ?? null,
  };
}

// ---------------------------------------------------------------------
// ② 算事实：风险信号（纯规则，供应商视角）
// ---------------------------------------------------------------------
export const RULES = [
  { code: "R1", theme: "还款风险", level: "high",
    when: (m, p) => m.应付周转天数 != null && p?.应付周转天数 != null && m.应付周转天数 - p.应付周转天数 >= 15,
    say: (m, p) => `应付账款周转天数从 ${p.应付周转天数} 天升到 ${m.应付周转天数} 天`,
    mean: "在拉长对供应商的付款周期，等于用上游的钱补自己的现金流",
    counter: "若同期营业成本明显下降，天数上升可能只是分母变小，不一定是真拖欠" },
  { code: "R2", theme: "还款风险", level: "high",
    when: (m) => m.经营现金流亿 != null && m.经营现金流亿 < 0,
    say: (m) => `本季经营性现金流 ${m.经营现金流亿} 亿元，为负`,
    mean: "主营业务在净流出现金，付款能力承压",
    counter: "单季备货或集中付款会造成短期为负，看连续两季才作数" },
  { code: "R3", theme: "还款风险", level: "high",
    when: (m) => m.现金覆盖应付 != null && m.现金覆盖应付 < 0.5,
    say: (m) => `货币资金 ${m.货币资金亿} 亿元，只覆盖应付款项的 ${m.现金覆盖应付} 倍`,
    mean: "账面现金盖不住应付款，一旦销量掉头，供应商回款排在最后",
    counter: "若有大额未提取授信额度或母公司支持，覆盖率低不等于付不出" },
  { code: "R4", theme: "还款风险", level: "warn",
    when: (m) => m.利润含金量 != null && m.利润含金量 < 0.5,
    say: (m) => `经营现金流 ÷ 归母净利 = ${m.利润含金量}`,
    mean: "账面利润没变成现金，利润质量存疑",
    counter: "季节性回款节奏会造成单季背离" },
  { code: "R5", theme: "盈利与降本压力", level: "high",
    when: (m, p) => m.毛利率 != null && p?.毛利率 != null && m.毛利率 - p.毛利率 <= -2,
    say: (m, p) => `毛利率从 ${p.毛利率}% 掉到 ${m.毛利率}%`,
    mean: "毛利被压缩，接下来大概率把降本压力传导到零部件采购价",
    counter: "若同期单车售价同步下降，说明是主动降价换量，不一定针对供应商" },
  { code: "R6", theme: "盈利与降本压力", level: "high",
    when: (m) => m.归母净利亿 != null && m.归母净利亿 < 0,
    say: (m) => `本季归母净利 ${m.归母净利亿} 亿元，亏损`,
    mean: "亏损期的车企对采购价格最敏感，也最容易延长账期",
    counter: "新品投放前的费用前置会造成阶段性亏损" },
  { code: "R7", theme: "盈利与降本压力", level: "warn",
    when: (m) => m.归母净利亿 != null && m.扣非归母亿 != null && m.归母净利亿 > 0 && m.扣非归母亿 < 0,
    say: (m) => `归母净利 ${m.归母净利亿} 亿元为正，但扣非后 ${m.扣非归母亿} 亿元为负`,
    mean: "主业实际亏损，账面盈利靠非经常性损益撑着",
    counter: "若非经常项是可持续的（如长期股权投资分红），性质不同" },
  { code: "R8", theme: "库存压力", level: "warn",
    when: (m, p) => m.存货周转天数 != null && p?.存货周转天数 != null && m.存货周转天数 - p.存货周转天数 >= 10,
    say: (m, p) => `存货周转天数从 ${p.存货周转天数} 天升到 ${m.存货周转天数} 天`,
    mean: "去化变慢，下个季度大概率减产、削减零部件拉货",
    counter: "新车型上市前的铺货会短期推高存货" },
  { code: "R9", theme: "库存压力", level: "warn",
    when: (m, p) => m.销量辆 != null && p?.销量辆 != null && m.销量辆 < p.销量辆 * 0.85,
    say: (m, p) => `销量从 ${p.销量辆} 辆降到 ${m.销量辆} 辆`,
    mean: "销量环比下滑超过 15%，直接影响我们的出货量",
    counter: "一季度受春节影响历来是淡季，同比比环比更有意义" },
  { code: "R10", theme: "自研替代威胁", level: "high",
    when: (m, p, ctx) => ctx.selfDevParts.some((x) => /量产|上车|流片/.test(x.stage)),
    say: (m, p, ctx) => ctx.selfDevParts.filter((x) => /量产|上车|流片/.test(x.stage))
      .map((x) => `${x.part} 自研进度「${x.stage}」（${x.product || "未命名"}${x.replace && x.replace !== "—" ? `，替代 ${x.replace}` : ""}）`).join("；"),
    mean: "自研件已进入量产/上车阶段，对应外购份额会被逐步替换",
    counter: "自研初期良率与成本往往不划算，短期内多为双轨并行" },
  { code: "R11", theme: "自研替代威胁", level: "warn",
    when: (m, p) => m.研发费率 != null && p?.研发费率 != null && m.研发费率 - p.研发费率 >= 1 && m.单车研发元 != null,
    say: (m, p) => `研发费率从 ${p.研发费率}% 升到 ${m.研发费率}%，单车研发 ${m.单车研发元} 元`,
    mean: "在加大自研投入，中期看会挤压外购件的份额",
    counter: "研发投入也可能全部投向整车平台与三电，不一定冲着智驾/座舱件来" },
];

function runRules(m, prev, ctx) {
  const hits = [];
  for (const r of RULES) {
    let ok = false;
    try { ok = r.when(m, prev, ctx); } catch (_) { ok = false; }
    if (!ok) continue;
    hits.push({
      code: r.code, theme: r.theme, level: r.level,
      evidence: r.say(m, prev, ctx), meaning: r.mean, counter: r.counter,
    });
  }
  return hits;
}

// ---------------------------------------------------------------------
// ③④ 生成解读 + 数字校验
// ---------------------------------------------------------------------
/** 把事实里出现过的数字全部收集起来，作为允许出现在正文里的白名单 */
function allowedNumbers(facts) {
  const pool = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === "number") {
      pool.add(String(v));
      pool.add(String(Math.round(v)));
      pool.add(v.toFixed(1)); pool.add(v.toFixed(2));
      pool.add(String(Math.abs(v))); pool.add(Math.abs(v).toFixed(1));
    } else if (typeof v === "string") {
      for (const m of v.matchAll(/-?\d+(?:\.\d+)?/g)) pool.add(m[0]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return pool;
}

export function numericGuard(review, facts) {
  const pool = allowedNumbers(facts);
  const text = JSON.stringify(review);
  const bad = new Set();
  for (const m of text.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const n = m[0];
    if (pool.has(n)) continue;
    if (pool.has(String(Number(n))) || pool.has(Number(n).toFixed(1)) || pool.has(Number(n).toFixed(2))) continue;
    // 年份、季度号、百分号前的整数 0-4 这类结构性数字放行
    if (/^(19|20)\d{2}$/.test(n) || ["0", "1", "2", "3", "4"].includes(n)) continue;
    bad.add(n);
  }
  return { ok: bad.size === 0, unsupported: [...bad] };
}

const SCHEMA = `{
 "verdict": "一句话结论，不超过 40 字",
 "grade": "健康 | 承压 | 预警",
 "themes": [
   {"title":"盈利与降本压力","points":["…","…"],"signals":["R5"]},
   {"title":"现金流与还款风险","points":["…"],"signals":["R1","R3"]},
   {"title":"库存压力","points":["…"],"signals":[]},
   {"title":"自研替代威胁","points":["…"],"signals":["R10"]}
 ],
 "supplier_implication": ["站在供应商角度，这一季意味着什么，2-4 条"],
 "watch_next": ["下个季度重点盯哪几个数，2-3 条"],
 "counter_evidence": "什么数据出现会推翻上面的判断，一句话"
}`;

function buildPrompt(name, facts) {
  return `下面是【${name}】${facts.本期.期间} 的财务事实，全部已经算好。请据此写一份财报解读。

【铁律，违反即作废】
1. **不得出现任何下面事实里没有的数字**。不许自己算比例、不许换算单位、不许四舍五入成别的数、不许估算。要引用数字就原样抄。
2. 不得引入事实之外的公司、期间、事件、传闻。
3. 每个 theme 的 points 要落到具体数字上，别说"较好""承压明显"这种没有支撑的形容。
4. signals 数组只填下面「已触发的风险信号」里真实存在的编号。
5. 这个站是**零部件供应商视角**的客户洞察。supplier_implication 要回答的是：
   这家客户还付不付得起款、会不会压我们的价、会不会把我们的件自研掉。不是"这家公司好不好"。
6. 数据缺失的地方就说缺，不要绕过去假装有结论。

【本期事实】
${JSON.stringify(facts.本期, null, 1)}

【上期（环比基准）】
${facts.上期 ? JSON.stringify(facts.上期, null, 1) : "无上期数据"}

【去年同期（同比基准）】
${facts.去年同期 ? JSON.stringify(facts.去年同期, null, 1) : "无同期数据"}

【环比与同比变化】
${JSON.stringify(facts.变化, null, 1)}

【已触发的风险信号（规则算出，不是你判断的）】
${facts.信号.length ? JSON.stringify(facts.信号, null, 1) : "本期没有触发任何风险信号"}

【该车企的自研部件进展】
${facts.自研部件.length ? JSON.stringify(facts.自研部件, null, 1) : "库里暂无记录"}

【数据缺口（这些字段是空的，别编）】
${facts.数据缺口.join("、") || "无"}

只输出一个 JSON 对象，结构：
${SCHEMA}`;
}

/** 模型不可用或校验一直不过时的兜底：纯规则拼出来的解读，一个字也不是模型写的 */
function ruleOnlyReview(name, facts) {
  const byTheme = {};
  for (const s of facts.信号) (byTheme[s.theme] ||= []).push(s);
  const grade = facts.信号.some((s) => s.level === "high") ? "预警"
    : facts.信号.length ? "承压" : "健康";
  return {
    verdict: `${name} ${facts.本期.期间}：触发 ${facts.信号.length} 条风险信号，其中高风险 ${facts.信号.filter((s) => s.level === "high").length} 条。`,
    grade,
    themes: Object.entries(byTheme).map(([title, ss]) => ({
      title, points: ss.map((s) => `${s.evidence} —— ${s.meaning}`), signals: ss.map((s) => s.code),
    })),
    supplier_implication: byTheme["还款风险"]?.length
      ? ["该客户回款风险信号已触发，建议复核账期与信用额度。"] : ["本期未触发还款风险类信号。"],
    watch_next: ["下季度盯：应付周转天数、经营性现金流、毛利率三项的环比方向。"],
    counter_evidence: facts.信号[0]?.counter || "补齐缺失字段后重新生成。",
  };
}

// ---------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------
export async function generateReview(idOrName, { year = null, q = null, refetchData = true, save = true } = {}) {
  const company = listCompanies().find((x) => x.id === idOrName || x.id === slug(idOrName) || x.name === idOrName);
  if (!company) throw new Error("未找到车企:" + idOrName);

  const steps = { fetch: [], facts: null, llm: null };
  if (refetchData) steps.fetch = await refetch(company);

  const all = getAll();
  const qs = all.quarterly.filter((x) => x.company === company.id)
    .sort((a, b) => a.year - b.year || a.q - b.q);
  if (!qs.length) throw new Error(`${company.name} 库里没有任何季度数据。先抓取或手工录入后再生成解读。`);

  const idx = year && q ? qs.findIndex((x) => x.year === +year && x.q === +q) : qs.length - 1;
  if (idx < 0) throw new Error(`${company.name} 没有 ${year}Q${q} 的数据`);
  const cur = qs[idx], prev = qs[idx - 1] || null;
  const yoy = qs.find((x) => x.year === cur.year - 1 && x.q === cur.q) || null;

  const m = metricsOf(cur), mPrev = metricsOf(prev), mYoy = metricsOf(yoy);
  const selfDevParts = all.parts.filter((p) => p.company === company.id && /自研|混合/.test(p.selfDev));
  const signals = runRules(m, mPrev, { selfDevParts });

  const CHANGE_KEYS = ["营业收入亿", "归母净利亿", "毛利率", "研发费率", "经营现金流亿",
    "存货周转天数", "应付周转天数", "销量辆", "单车净利元"];
  const 变化 = {};
  for (const k of CHANGE_KEYS) {
    变化[k] = {
      本期: m[k],
      环比: mPrev ? (typeof m[k] === "number" && typeof mPrev[k] === "number"
        ? (k.endsWith("率") || k.endsWith("天数") ? r1(m[k] - mPrev[k]) + (k.endsWith("率") ? "pct" : "天") : yoyPct(m[k], mPrev[k]) + "%") : null) : null,
      同比: mYoy ? (typeof m[k] === "number" && typeof mYoy[k] === "number"
        ? (k.endsWith("率") || k.endsWith("天数") ? r1(m[k] - mYoy[k]) + (k.endsWith("率") ? "pct" : "天") : yoyPct(m[k], mYoy[k]) + "%") : null) : null,
    };
  }
  const 数据缺口 = Object.entries(m).filter(([k, v]) => v == null && k !== "期间").map(([k]) => k);

  const facts = {
    车企: company.name, 定位: company.type === "core" ? "核心客户" : "竞品", 代码: company.ticker,
    本期: m, 上期: mPrev, 去年同期: mYoy, 变化,
    信号: signals, 自研部件: selfDevParts.map((p) => ({ part: p.part, selfDev: p.selfDev, stage: p.stage, product: p.product, replace: p.replace })),
    数据缺口,
    出处: (cur.sources || []).slice(0, 4),
  };
  steps.facts = { period: m.期间, signals: signals.length, gaps: 数据缺口.length };

  // ③④ 写解读 + 数字校验
  let review = null, mode = "rule_only", guard = { ok: true, unsupported: [] }, attempts = 0;
  if (process.env.DEEPSEEK_API_KEY) {
    for (let i = 0; i < 2; i++) {
      attempts = i + 1;
      try {
        const extra = i === 0 ? "" :
          `\n\n上一次你写出了事实里没有的数字：${guard.unsupported.join("、")}。请重写，只用上面给出的数值。`;
        const out = await chatJSON(buildPrompt(company.name, facts) + extra, 3000);
        const g = numericGuard(out, facts);
        if (g.ok) { review = out; mode = "llm"; guard = g; break; }
        guard = g;
      } catch (e) { steps.llm = { error: e.message }; break; }
    }
  } else {
    steps.llm = { error: "未配置 DEEPSEEK_API_KEY,使用纯规则版解读" };
  }
  if (!review) {
    review = ruleOnlyReview(company.name, facts);
    mode = process.env.DEEPSEEK_API_KEY ? "rule_fallback" : "rule_only";
  }

  const rec = {
    company: company.id, companyName: company.name, year: cur.year, q: cur.q,
    ...review,
    mode, guard, attempts,
    signals_detail: signals,
    metrics: m, metricsPrev: mPrev, changes: 变化,
    dataGaps: 数据缺口,
    sources: facts.出处,
    fetchSteps: steps.fetch,
    generatedAt: new Date().toISOString(),
  };
  if (save) upsertReview(rec, { manual: false });
  return rec;
}

/** 全量:给所有有结构化源的车企各生成一份最新期解读 */
export async function generateAllReviews({ onlyCore = false } = {}) {
  const cs = listCompanies().filter((c) => (!onlyCore || c.type === "core") && (pickAShare(c.ticker) || pickHK(c.ticker)));
  const out = [];
  for (const c of cs) {
    try { const r = await generateReview(c.name, { refetchData: true }); out.push({ company: c.name, period: `${r.year}Q${r.q}`, grade: r.grade, mode: r.mode, signals: r.signals_detail.length }); }
    catch (e) { console.error("[fin_review]", c.name, e.message); out.push({ company: c.name, error: e.message }); }
  }
  return { total: cs.length, done: out.filter((x) => !x.error).length, detail: out };
}
