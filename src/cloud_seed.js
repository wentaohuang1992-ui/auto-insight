// 云算力·AI 更新:业界 GPU/昇腾 租赁价格趋势 + AI 芯片供需 + 价格指数 + 观点。Core-Hour 为内部数据,不抓。
import { research } from "./research.js";
import * as db from "./cloud_db.js";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const SCHEMA = `基于下方资料,整理业界 AI 算力(GPU/昇腾)租赁价格与芯片供需的最新趋势。只用资料中真实信息,不编造。
JSON:{"prices":[{"vendor":"华为云/阿里云/腾讯云/火山引擎/AWS","chip":"型号","mom":环比百分数(降为负),"yoy":同比百分数,"supply":"偏紧/紧平衡/缓和/回稳","sources":[{"title":"","url":""}]}],
"chips":[{"name":"NVIDIA H200/H20/昇腾910B 等","tightness":"偏紧/紧平衡/缓和","leadtime":"较长/正常/排产中","trend":"坚挺/走低/缓降"}],
"indexMom":本月算力价格指数环比百分数(降为负),
"opinion":"3-4句:本月价格走势、芯片供需、对大规模训练 Core-Hour 成本与 Q4 研发预算的提示(可用**加粗**)"}`;

export async function updateCloud() {
  const d = await research({
    queries: ["GPU 算力 租赁 价格 下降 云", "H20 昇腾 910B 供需 价格", "英伟达 H200 B200 供需 交期", "云厂商 算力 降价 2026"],
    gnewsQueries: ["GPU 算力 价格", "昇腾 H20 供需", "英伟达 H200 供需"],
    gnewsWhen: "30d", schema: SCHEMA, freshness: "oneMonth", count: 10, summaryLen: 600, maxTokens: 5000, model: MODEL,
  });
  let np = 0, nc = 0;
  for (const p of (Array.isArray(d.prices) ? d.prices : [])) {
    if (!p || !p.vendor) continue;
    const r = db.prices.upsertBy("vendor", { vendor: p.vendor, chip: p.chip || "", mom: p.mom ?? null, yoy: p.yoy ?? null, supply: p.supply || "", sources: Array.isArray(p.sources) ? p.sources.slice(0, 2) : [] }, { manual: false });
    if (r.ok) np++;
  }
  for (const c of (Array.isArray(d.chips) ? d.chips : [])) {
    if (!c || !c.name) continue;
    const r = db.chips.upsertBy("name", { name: c.name, tightness: c.tightness || "", leadtime: c.leadtime || "", trend: c.trend || "" }, { manual: false });
    if (r.ok) nc++;
  }
  if (d.indexMom != null && !isNaN(+d.indexMom)) { const idx = db.getAll().priceIndex; const last = idx[idx.length - 1] || 100; db.pushIndex(+(last * (1 + (+d.indexMom) / 100)).toFixed(1)); }
  if (d.opinion && String(d.opinion).trim()) db.setOpinion(String(d.opinion).trim() + "\n\n_(AI 起草 · 请核对)_");
  console.log("[cloud] prices", np, "chips", nc);
  return { prices: np, chips: nc };
}
