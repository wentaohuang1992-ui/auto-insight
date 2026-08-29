// 港股/美股车企月度交付量:它们不发 A 股式产销快报,而是每月月初官方发布交付数据(媒体广泛转载、多来源一致)。
// 用 DeepSeek 原生联网搜索取近 N 个月交付量,抽成结构化入库 salesMonthly。配来源链接 + "待核"标记。
// 纯电/增程新势力(理想/蔚来/小鹏/零跑)≈100% 新能源,故 nev≈总交付;吉利/奇瑞为混合+出口,分别取。
import { listCompanies, upsertSales } from "./fin_db.js";
import { pickAShare } from "./fin_em.js";
import { responsesWebSearch } from "./ds_search.js";
import { parseJSON } from "./llm.js";

const INT = (v) => (v != null && !isNaN(+v) ? Math.round(+v) : null);

export async function fetchSalesHK(nameOrId, { months = 12, apply = true } = {}) {
  const c = listCompanies().find((x) => x.id === nameOrId || x.name === nameOrId);
  if (!c) return { error: "未找到车企:" + nameOrId };
  if (pickAShare(c.ticker)) return { error: c.name + " 是 A 股(应走产销快报抓取)" };

  const instr = `你是严谨的汽车行业数据整理助手,用联网搜索查「${c.name}」最近约 ${months} 个月的官方月度交付量(销量)。
要求:
- 优先采用公司官方每月发布的交付数字(每月月初发布、被多家媒体一致转载者最可信)。
- 每个月给出:当月交付总量 sales;新能源交付 nev(纯电/增程新势力≈总交付,则 nev=sales);海外/出口 overseas(若有报道,否则 null);本年累计 ytd(若有,否则 null)。
- 数字去掉千分位逗号;不确定或查不到就填 null,绝不编造或估算。
- 勾稽:ytd 须 ≥ sales;nev、overseas 须 ≤ sales。
只输出一个 JSON 对象,不要任何解释或 markdown:
{"months":[{"year":2026,"month":7,"sales":整数,"nev":整数或null,"overseas":整数或null,"ytd":整数或null}, ...]}`;
  const input = `${c.name} 2025年 2026年 每月 交付量 销量 新能源 出口 官方数据`;

  let sr;
  try { sr = await responsesWebSearch(instr, input); } catch (e) { return { company: c.name, error: "搜索失败:" + e.message }; }
  const parsed = parseJSON(sr.text);
  const arr = parsed && Array.isArray(parsed.months) ? parsed.months : [];
  const cites = (sr.citations || []).map((x) => ({ title: x.title || "", url: x.url })).filter((x) => x.url);
  const out = { company: c.name, engine: "native-search", saved: 0, months: [], sources: cites.slice(0, 6), errors: [] };
  if (!arr.length) { out.error = "搜索未返回可解析的月度数据(见 rawText)"; out.rawText = String(sr.text || "").slice(0, 500); return out; }

  for (const r of arr) {
    const year = INT(r.year), month = INT(r.month), ms = INT(r.sales);
    if (!year || !month || month < 1 || month > 12 || ms == null) { out.errors.push({ item: r, err: "年月或销量缺失" }); continue; }
    let ys = INT(r.ytd), nev = INT(r.nev), ovs = INT(r.overseas);
    const bad = [];
    if (ys != null && ys < ms) { bad.push("累计<当月"); ys = null; }
    if (nev != null && nev > ms * 1.05) { bad.push("新能源>当月"); nev = null; }
    if (ovs != null && ovs > ms * 1.05) { bad.push("海外>当月"); ovs = null; }
    const rec = {
      company: c.id, year, month, sales: ms, ytd: ys, nev, nevYtd: null, overseas: ovs, overseasYtd: null,
      sources: cites.slice(0, 3),
      note: `AI搜索·待核·新能源${nev != null ? nev.toLocaleString() : "—"}·海外${ovs != null ? ovs.toLocaleString() : "—"}${bad.length ? " ⚠" + bad.join(",") : ""}`,
    };
    if (apply) { const u = upsertSales(rec, { manual: false }); if (u && u.ok !== false) out.saved++; }
    out.months.push({ year, month, sales: ms, ytd: ys, nev, overseas: ovs, saved: apply, ...(bad.length ? { flagged: bad } : {}) });
  }
  out.months.sort((a, b) => b.year - a.year || b.month - a.month);
  return out;
}
