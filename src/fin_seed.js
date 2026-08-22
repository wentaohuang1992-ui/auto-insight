// 财报抓取层:逐车企检索(优先财报/交易所公告)→ DeepSeek 抽取 → 入库为"草稿"(manual:false)。
// 原则:数据以财报为准;只填能在财报/公告中查到的数字,查不到留 null,绝不编造;每条带来源。
// 单季口径:利润表项为当季、资产负债项为期末;A股若仅有累计,尽力换算单季并在 note 标注。
import { research } from "./research.js";
import { listCompanies, upsertQuarterly, upsertSales, upsertPart, slug } from "./fin_db.js";
import { pool } from "./pool.js";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

function finSchema(name) {
  return `请**仅依据财报/季报/年报/业绩公告/交易所公告**整理【${name}】的财务数据(金额单位:亿元;销量单位:辆)。
要求:① 数据以财报为准,只填能在下方资料(财报/公告)中查到的数字;查不到的字段留 null,**绝不编造或估算**。
② 口径:利润表项(营收/净利/营业成本/研发/经营现金流/筹资现金流)= **当季(单季)**;资产负债项(存货/应付/货币资金/有息负债/应收/总资产/总负债)= **期末**。若财报仅披露累计数,尽量换算为单季,并在该季 note 注明"由累计换算"。
③ 每条记录的 sources 必须取自下方资料中**真实出现过的链接**(优先官方财报、交易所/港交所公告、巨潮资讯、公司IR、权威财经),格式 [{title,url}];没有可靠来源的数字宁可留 null。
④ 季度尽量给**最近 4-6 个季度**;月销给**最近 12-13 个月**。
JSON 结构:
{"quarterly":[{"year":2026,"q":1,"revenue":null,"netProfit":null,"operatingCost":null,"inventory":null,"ap":null,"rdSpend":null,"ocf":null,"cash":null,"stDebt":null,"ltDebt":null,"ar":null,"financingCF":null,"totalAssets":null,"totalLiab":null,"sales":null,"note":"","sources":[{"title":"","url":""}]}],
"monthly":[{"year":2026,"month":1,"sales":null,"sources":[{"title":"","url":""}]}],
"parts":[{"part":"智驾SoC","selfDev":"自研/外购/混合","stage":"规划/研发/流片/上车/量产","product":"","replace":"被替代的外购方案","note":"","sources":[{"title":"","url":""}]}]}
其中 parts 为该车企**自研智驾/座舱部件**(智驾SoC、座舱SoC、智能座舱域控、激光雷达、摄像头等)的公开进展,确无依据则空数组。`;
}

export async function seedCompanyFin(company) {
  const name = company.name;
  const queries = [
    `${name} 最新季报 年报 营业收入 净利润 营业成本`,
    `${name} 季度 存货 应付账款 研发投入 经营活动现金流量`,
    `${name} 货币资金 有息负债 资产负债率 财报`,
    `${name} 月度销量 交付量 2025 2026`,
  ];
  const gn = [`${name} 业绩 财报 销量`];
  const d = await research({
    queries, schema: finSchema(name), freshness: "noLimit",
    count: 10, summaryLen: 700, maxTokens: 7000, model: MODEL, gnewsQueries: gn, gnewsWhen: "",
  });
  const cid = company.id;
  const okSrc = (s) => Array.isArray(s) ? s.filter((x) => x && x.url).slice(0, 3) : [];
  let nq = 0, nm = 0, np = 0;

  for (const q of (Array.isArray(d.quarterly) ? d.quarterly : [])) {
    if (!q || !q.year || !q.q) continue;
    const r = upsertQuarterly({ company: cid, year: q.year, q: q.q, ...q, sources: okSrc(q.sources) }, { manual: false });
    if (r.ok) nq++;
  }
  for (const m of (Array.isArray(d.monthly) ? d.monthly : [])) {
    if (!m || !m.year || !m.month || m.sales == null) continue;
    const r = upsertSales({ company: cid, year: m.year, month: m.month, sales: m.sales, sources: okSrc(m.sources) }, { manual: false });
    if (r.ok) nm++;
  }
  for (const p of (Array.isArray(d.parts) ? d.parts : [])) {
    if (!p || !p.part) continue;
    const r = upsertPart({ company: cid, part: p.part, selfDev: p.selfDev, stage: p.stage, product: p.product, replace: p.replace, note: p.note, sources: okSrc(p.sources) }, { manual: false });
    if (r.ok) np++;
  }
  return { quarter: nq, month: nm, part: np };
}

export async function seedAllFin() {
  const cs = listCompanies();
  await pool(cs, 3, async (c) => {
    try { const n = await seedCompanyFin(c); console.log("[fin-seed]", c.name, JSON.stringify(n)); }
    catch (e) { console.error("[fin-seed]", c.name, e.message); }
  });
  return { companies: cs.length };
}

export async function seedOneCompanyFin(idOrName) {
  const cs = listCompanies();
  const c = cs.find((x) => x.id === idOrName || x.id === slug(idOrName) || x.name === idOrName);
  if (!c) throw new Error("未找到车企:" + idOrName);
  const n = await seedCompanyFin(c);
  console.log("[fin-seed-one]", c.name, JSON.stringify(n));
  return { company: c.name, ...n };
}
