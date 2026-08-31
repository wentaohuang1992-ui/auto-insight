// 中低端智驾市场洞察:downshift.json。集合:
//  penetration 渗透矩阵 {id(band::config),band,config,value,trend,note,sources,manual}
//  tiers 方案档位 {id,tier,priceBand,bom,chip,ability,sensor,note,sources,manual}
//  chips 国产芯片动向 {id,name,tops,position,status,models,note,sources,manual}
//  feed 情报流 {id,kind(noa/vis/chip),title,source,url,date,insight,createdAt}
//  opinion 决策观点 {text,updatedAt}
import { readStore, writeStore, resolveStorePath } from "./store.js";

const P = resolveStorePath("DS_PATH", "downshift.json");
const now = () => new Date().toISOString();
const slug = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

const BANDS = ["≤10万", "10-15万", "15-20万", "20-30万", ">30万"];
const CONFIGS = ["高速NOA", "城市NOA", "行泊一体", "纯视觉方案", "激光雷达", "高阶座舱"];
// 预置渗透率示例 [value, trend]，行=band 列=config
const PEN = {
  "≤10万": [[18, 12], [2, 2], [34, 20], [86, 9], [1, 0], [22, 10]],
  "10-15万": [[47, 18], [12, 10], [61, 24], [72, 6], [8, 6], [41, 15]],
  "15-20万": [[73, 14], [38, 26], [80, 12], [48, 11], [35, 18], [66, 12]],
  "20-30万": [[88, 5], [64, 22], [85, 4], [29, 9], [68, 10], [82, 6]],
  ">30万": [[95, 0], [86, 14], [90, 0], [12, -3], [89, 3], [93, 0]],
};
const TIERS = [
  { tier: "入门 · 纯视觉行泊一体", priceBand: "≤10万", bom: "¥2–4k", chip: "地平线 J6E / 黑芝麻 A1000", ability: "高速NOA·记忆泊车", sensor: "纯视觉,无激光" },
  { tier: "中阶 · 轻量城市NOA", priceBand: "15–20万", bom: "¥6–10k", chip: "征程6M / 华山A2000", ability: "城市NOA(纯视觉或1激光)", sensor: "纯视觉 或 1 激光" },
  { tier: "高阶 · 全场景城市NOA", priceBand: ">20万", bom: "¥15–25k", chip: "华为 / 英伟达Thor / J6P", ability: "全场景城市NOA", sensor: "1–2 激光 + 大算力" },
];
const CHIPS = [
  { name: "地平线 征程6E/M", tops: "80–128", position: "中阶 行泊一体/轻NOA", status: "量产上车", models: "多家 10–20 万车型" },
  { name: "地平线 征程6P", tops: "560", position: "高阶 城市NOA", status: "上车中", models: "20 万级旗舰" },
  { name: "黑芝麻 华山A1000/A2000", tops: "58 / 250+", position: "行泊一体→城市NOA", status: "上车中", models: "东风/多家" },
  { name: "爱芯 / 芯擎 等", tops: "—", position: "入门行泊一体/座舱", status: "导入期", models: "示例" },
];
// 智能驾驶厂商(地平线 / Momenta)与智能座舱厂商(车机 / 屏幕)。
// 每家含:业务面(定位/方案/客户/量产/份额) + 财务面(营收/毛利/净利/研发/融资估值),数值留空待补。
const ADAS = [
  {
    name: "地平线机器人", tag: "芯片+算法", listed: "09660.HK",
    positioning: "车规级智驾计算方案供应商,征程系列芯片 + Horizon Mono/Pilot/SuperDrive 全栈",
    products: "征程6 系列(6B/6E/6M/6P,10–560 TOPS)、HSD 城市辅助驾驶",
    customers: "比亚迪、理想、上汽、大众(酷睿程合资)、奇瑞、长安等",
    massProd: "征程6 系列 2025 起规模上车;J6P 面向 20 万级旗舰",
    share: "中国 L2 计算方案市占率居国产第一梯队",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "已于港交所上市",
    note: "商业模式:芯片硬件 + 算法授权 + 技术服务三段收入,毛利结构与纯芯片公司不同",
    sources: [],
  },
  {
    name: "Momenta", tag: "算法", listed: "06880.HK",
    positioning: "以数据驱动的量产智驾算法供应商,飞轮式迭代;2026 年定位「物理AI」平台,R7 世界模型",
    products: "Mpilot 量产辅助驾驶、MSD 城市领航、R7 世界模型;延伸 Robotaxi/Robovan/Robotruck",
    customers: "上汽智己、比亚迪腾势、广汽、奔驰、奥迪、本田等;Robotaxi 合作 Uber、Grab、奔驰",
    massProd: "搭载车辆规模突破 100 万台,交付超 100 款量产车型,累计定点车型超 210 款",
    share: "第三方城市 NOA 市占率约 65%,居首;「地卓华魔」四家主导格局之一",
    revenue: "2025 年 24.13 亿元(2023 年 7.43 亿,三年 CAGR 超 80%)",
    grossMargin: "2025 年 71.6%(2023 年 17.5%)",
    netProfit: "2025 年经调整亏损 3.03 亿元,较 2023 年 10.9 亿大幅收窄",
    rd: "", funding: "2026-07-08 港交所上市,发行价 295.6 港元,市值约 700 亿港元",
    note: "许可收入从 2023 年 0.23 亿增至 2025 年 9.68 亿(三年 42 倍),纯软件授权边际成本低是毛利率跃升主因",
    sources: [],
  },
  {
    name: "华为车BU / 引望", tag: "全栈(芯片+算法+座舱)", listed: "引望为合资公司,未上市",
    positioning: "全栈自研智驾+座舱方案,以品牌化运作(乾崑ADS)构建护城河;深耕高端并向主流下探",
    products: "乾崑智驾 ADS 系列、MDC 计算平台、鸿蒙座舱;HI 模式与鸿蒙智行两种合作形态",
    customers: "赛力斯(问界)、奇瑞(智界)、北汽(享界)、江淮(尊界)、深蓝、岚图、阿维塔等",
    massProd: "乾崑智驾 ADS 累计搭载量突破 100 万辆;ADS4.0+鸿蒙座舱下探至 15–20 万元市场",
    share: "「地卓华魔」四家主导格局之一,高端智驾市占领先",
    revenue: "", grossMargin: "", netProfit: "", rd: "2026 年预计研发投入超 180 亿元", funding: "引望引入赛力斯、阿维塔等车企股东",
    note: "唯一同时做芯片、算法、座舱的全栈玩家;与地平线是成本 vs 性能的两条路线",
    sources: [],
  },
  {
    name: "卓驭科技(原大疆车载)", tag: "算法+硬件", listed: "未上市",
    positioning: "从大疆车载独立,主打高性价比方案;2026 年战略转向「移动智能基座」",
    products: "灵眸智驾(惯导双目视觉方案)、成行平台,以低算力实现城市 NOA",
    customers: "上汽通用五菱(宝骏)、大众、奇瑞等",
    massProd: "灵眸智驾自宝骏 KiWi EV 起量产,以低成本方案切入主流价格带",
    share: "「地卓华魔」四家主导格局之一,量产表现突出",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "大疆体系孵化后独立融资",
    note: "以视觉+惯导替代激光雷达,是「智驾平权」下沉到 10 万级的关键推手",
    sources: [],
  },
  {
    name: "黑芝麻智能", tag: "芯片", listed: "02533.HK",
    positioning: "车规级智驾芯片供应商,华山/武当系列,对标地平线",
    products: "华山 A1000/A2000(行泊一体→城市NOA)、武当 C1200 跨域计算",
    customers: "东风、吉利、一汽等",
    massProd: "华山 A1000 已量产上车,A2000 面向高阶",
    share: "国产智驾芯片第二梯队,是地平线的主要国产对手",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "港股上市",
    note: "纯芯片路线,不做整套方案,商业模式与地平线的「芯片+算法」不同",
    sources: [],
  },
  {
    name: "元戎启行", tag: "算法", listed: "未上市",
    positioning: "深耕城区智驾的算法供应商,端到端路线",
    products: "DeepRoute IO 平台、城市 NOA 方案",
    customers: "长城、smart 等",
    massProd: "2025 年累计交付超 20 万辆;2026 年目标 100 万辆",
    share: "城区 NOA 第三方供应商中交付量居前",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "多轮融资,含长城战略投资",
    note: "增速快但基数小,能否兑现 5 倍增长目标是 2026 年观察点",
    sources: [],
  },
];
const COCKPIT = [
  {
    name: "德赛西威", tag: "车机/域控", listed: "002920.SZ", category: "车机",
    positioning: "智能座舱域控 + 智驾域控 Tier1,国内座舱域控出货领先",
    products: "智能座舱域控制器、车载信息娱乐、智驾域控(与英伟达合作)",
    customers: "理想、小鹏、吉利、长城、奇瑞等", massProd: "座舱域控大规模量产",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "A股上市",
    note: "座舱与智驾双域布局,智驾域控贡献增量但拉低整体毛利率", sources: [],
  },
  {
    name: "华阳集团", tag: "座舱电子/显示总成", listed: "002906.SZ", category: "车机,屏幕",
    positioning: "座舱电子 Tier1,HUD 出货领先;显示环节做模组与总成集成(非面板厂)",
    products: "座舱域控、HUD(AR/VPD)、车载显示屏与液晶仪表、电子外后视镜、无线充电",
    customers: "长城、比亚迪、长安(深蓝)、赛力斯、奇瑞等",
    massProd: "HUD 累计出货超 200 万套;座舱域控 2024 年出货超 30 万套;VPD 全球首家量产",
    share: "HUD 国内份额居前;液晶仪表与屏显示份额快速提升",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "A股上市",
    note: "显示环节是「模组/总成集成」,与京东方精电、天马的面板制造不在同一环节;HUD 与 VPD 是差异化利润点",
    sources: [],
  },
  {
    name: "京东方精电", tag: "车载屏", listed: "00710.HK", category: "屏幕",
    positioning: "京东方旗下车载显示平台,车载显示屏出货量全球领先",
    products: "车载 TFT/LCD、Mini-LED 背光、多联屏、仪表屏",
    customers: "小鹏、极氪、奇瑞、吉利、长安、东风风行等",
    massProd: "为小鹏 G9 定制近 30 英寸双联屏、G6 提供 10.25 英寸全液晶仪表",
    share: "车载显示面板全球份额居首(2022 年约 17%)",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "港股上市",
    note: "面板价格周期性强,大尺寸化与多屏化是量价驱动", sources: [],
  },
  {
    name: "天马微电子", tag: "车载屏", listed: "000050.SZ", category: "屏幕",
    positioning: "车载显示面板主力供应商,LTPS 车载屏份额居前",
    products: "车载 LTPS/AMOLED 显示屏、触控模组",
    customers: "比亚迪、长城、吉利、红旗、宝马、福特、本田等", massProd: "LTPS 车载屏规模供货",
    share: "2024 年全球车载显示出货 3690 万片、份额 15.9%,居第二且增速最快",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "A股上市",
    note: "面板厂路线,与京东方精电正面竞争,产能与良率决定成本", sources: [],
  },
  {
    name: "长信科技", tag: "触控/贴合模组", listed: "300088.SZ", category: "屏幕",
    positioning: "车载触控与显示模组厂,做面板之后的触显一体化集成",
    products: "车载 Sensor、触控模组、盖板、触显一体化模组、减薄",
    customers: "面板厂与座舱 Tier1(为其配套模组)",
    massProd: "已完成「车载Sensor+触控模组+盖板+触显一体化模组」产业链布局",
    share: "车载触控贴合环节国内主要供应商之一",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "A股上市",
    note: "位于面板与总成之间的中间环节,全贴合与大尺寸曲面是技术壁垒", sources: [],
  },
  {
    name: "伟时电子", tag: "背光模组", listed: "605218.SH", category: "屏幕",
    positioning: "车载背光显示模组供应商,全球该环节领先企业之一",
    products: "背光显示模组、液晶显示模组/组件、触控装饰与智能表面",
    customers: "夏普、JDI、天马、伟世通、哈曼、京瓷、松下等",
    massProd: "长期稳定配套多家国际面板厂与 Tier1",
    share: "全球车载背光模组领域领先企业之一",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "A股上市",
    note: "背光是 Mini-LED 升级的直接受益环节,但客户集中于面板厂,议价能力受限", sources: [],
  },
  {
    name: "友达 / 群创", tag: "面板(中国台湾)", listed: "2409.TW / 3481.TW", category: "屏幕",
    positioning: "中国台湾面板双雄,车载显示面板全球主要供应商",
    products: "车载 TFT-LCD、Mini-LED 背光面板、大尺寸联屏",
    customers: "国际车企与 Tier1 为主", massProd: "长期供应全球车厂",
    share: "两者在全球车载显示面板市占率合计约两成(2022 年数据)",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "中国台湾上市",
    note: "与京东方、天马正面竞争;在高端车载与海外客户上仍有优势", sources: [],
  },
  {
    name: "伟世通 Visteon", tag: "座舱Tier1(外资)", listed: "VC(纳斯达克)", category: "车机,屏幕",
    positioning: "全球座舱电子 Tier1,数字座舱与显示总成",
    products: "座舱域控、数字仪表、大尺寸显示总成、SmartCore",
    customers: "国际车企与合资品牌为主", massProd: "全球多平台量产",
    share: "数字仪表与座舱域控全球主要供应商",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "美股上市",
    note: "在华面临德赛西威、华阳等本土 Tier1 的份额挤压,是「国产替代」的对照组", sources: [],
  },
  {
    name: "科大讯飞", tag: "座舱语音", listed: "002230.SZ", category: "车机",
    positioning: "车载语音交互方案龙头,座舱软件侧的关键供应商",
    products: "车载语音识别与合成、语音大模型、智能助理",
    customers: "广泛配套自主与合资品牌", massProd: "2026 年 1 月装机 57.8 万套",
    share: "2026 年 1 月车载语音装机份额 44.2%,居第一",
    revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "A股上市",
    note: "座舱竞争正从硬件转向软件与 AI 体验,语音是最先规模化的入口", sources: [],
  },
];

const OPINION = '当前**高速 NOA + 行泊一体**已凭纯视觉 + 国产芯片下探到 **10–15 万**带；**城市 NOA** 的降本临界点正落在 **15–20 万**——这也是下沉竞争最激烈的战场。(示例,可编辑)';

function blank() { return { penetration: [], tiers: [], chips: [], feed: [], adas: [], cockpit: [], quarters: [], opinion: { text: "", updatedAt: null }, updatedAt: null }; }
function load() { return { ...blank(), ...readStore(P, blank) }; }
function save(db) { db.updatedAt = now(); return writeStore(P, db); }

export function ensureSeeded() {
  const db = load(); let ch = false;
  if (!db.penetration.length) { for (const b of BANDS) CONFIGS.forEach((c, i) => db.penetration.push({ id: b + "::" + c, band: b, config: c, value: PEN[b][i][0], trend: PEN[b][i][1], note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.tiers.length) { db.tiers = TIERS.map((t, i) => ({ id: "tier" + (i + 1), ...t, note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.chips.length) { db.chips = CHIPS.map((c, i) => ({ id: "chip" + (i + 1), ...c, note: "", sources: [], manual: false, updatedAt: now() })); ch = true; }
  if (!db.adas || !db.adas.length) { db.adas = ADAS.map((x, i) => ({ id: "adas" + (i + 1), ...x, manual: false, updatedAt: now() })); ch = true; }
  if (!db.cockpit || !db.cockpit.length) { db.cockpit = COCKPIT.map((x, i) => ({ id: "ckpt" + (i + 1), ...x, manual: false, updatedAt: now() })); ch = true; }
  if (!db.opinion.text) { db.opinion = { text: OPINION, updatedAt: now() }; ch = true; }
  if (ch) save(db);
  return db;
}
export function getAll() {
  const db = ensureSeeded();
  return { penetration: db.penetration, tiers: db.tiers, chips: db.chips, feed: db.feed.slice(0, 40), adas: db.adas || [], cockpit: db.cockpit || [], quarters: db.quarters || [], opinion: db.opinion, bands: BANDS, configs: CONFIGS, meta: { updatedAt: db.updatedAt, feed: db.feed.length } };
}

// 渗透率
export function putPenetration(id, patch) {
  const db = ensureSeeded(); const i = db.penetration.findIndex(x => x.id === id); if (i < 0) return null;
  const v = patch.value, t = patch.trend;
  db.penetration[i] = { ...db.penetration[i], value: v == null || v === "" ? null : +v, trend: t == null || t === "" ? null : +t, note: patch.note ?? db.penetration[i].note, manual: true, updatedAt: now() };
  save(db); return db.penetration[i];
}
export function upsertPenetration(rec, { manual = false } = {}) {
  if (!rec || !rec.band || !rec.config) return { skipped: "invalid" };
  const db = ensureSeeded(); const id = rec.band + "::" + rec.config; const i = db.penetration.findIndex(x => x.id === id);
  if (i >= 0) { if (db.penetration[i].manual && !manual) return { skipped: "manual" }; db.penetration[i] = { ...db.penetration[i], value: rec.value ?? null, trend: rec.trend ?? null, sources: rec.sources || [], manual, updatedAt: now() }; }
  else db.penetration.push({ id, band: rec.band, config: rec.config, value: rec.value ?? null, trend: rec.trend ?? null, note: "", sources: rec.sources || [], manual, updatedAt: now() });
  save(db); return { ok: true };
}
// 通用 tiers/chips
function crud(coll) {
  return {
    put(id, patch) { const db = ensureSeeded(); const i = db[coll].findIndex(x => x.id === id); if (i < 0) return null; db[coll][i] = { ...db[coll][i], ...patch, id, manual: true, updatedAt: now() }; save(db); return db[coll][i]; },
    add(rec) { const db = ensureSeeded(); const id = coll + "_" + slug(rec.name || rec.tier || Date.now()) + "_" + Math.random().toString(36).slice(2, 6); db[coll].push({ id, ...rec, manual: true, updatedAt: now() }); save(db); return db[coll][db[coll].length - 1]; },
    del(id) { const db = ensureSeeded(); const n = db[coll].length; db[coll] = db[coll].filter(x => x.id !== id); save(db); return n !== db[coll].length; },
  };
}
export const tiers = crud("tiers");
export const chips = crud("chips");

// 情报流
export function setFeed(items) { const db = ensureSeeded(); const mapped = (items || []).filter(x => x && x.title).map((x, i) => ({ id: "f" + Date.now() + "_" + i, kind: ["noa", "vis", "chip"].includes(x.kind) ? x.kind : "noa", title: x.title, source: x.source || "", url: x.url || "", date: x.date || "", insight: x.insight || "", createdAt: now() })); db.feed = [...mapped, ...db.feed].slice(0, 60); save(db); return mapped.length; }
export function setOpinion(text) { const db = ensureSeeded(); db.opinion = { text: text || "", updatedAt: now() }; save(db); return db.opinion; }
export { BANDS, CONFIGS };

// —— 智能驾驶 / 智能座舱 厂商卡片的增删改 ——
function coll(name) { return name === "adas" ? "adas" : "cockpit"; }
export function vendorAdd(name, rec) {
  const db = ensureSeeded(), k = coll(name);
  const row = { id: k + Date.now().toString(36), name: rec.name || "未命名", manual: true, sources: rec.sources || [], updatedAt: now(), ...rec };
  db[k] = db[k] || []; db[k].push(row); save(db); return row;
}
export function vendorPut(name, id, patch) {
  const db = ensureSeeded(), k = coll(name), i = (db[k] || []).findIndex(x => x.id === id);
  if (i < 0) return null;
  db[k][i] = { ...db[k][i], ...patch, manual: true, updatedAt: now() };
  save(db); return db[k][i];
}
export function vendorDel(name, id) {
  const db = ensureSeeded(), k = coll(name), n = (db[k] || []).length;
  db[k] = (db[k] || []).filter(x => x.id !== id);
  const ok = db[k].length < n; if (ok) save(db); return ok;
}

// —— 供应商财务与出货量库(参照车企财务模块 fin_db 的季度记录模式) ——
// quarters: { id: "<vendorId>-<year>Q<q>", vendorId, kind(adas/cockpit), year, q,
//   revenue 营收(亿元), grossMargin 毛利率(%), netProfit 归母净利(亿元), rdSpend 研发(亿元),
//   shipment 出货量, shipUnit 单位(万套/万片/万辆), asp 单价(元), note, sources, manual }
const QNUM = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : null; };
function cleanVQ(r) {
  const o = {};
  for (const k of ["revenue", "grossMargin", "netProfit", "rdSpend", "shipment", "asp"]) o[k] = QNUM(r[k]);
  o.shipUnit = r.shipUnit || "万套";
  o.note = r.note || "";
  o.sources = Array.isArray(r.sources) ? r.sources : [];
  return o;
}
/** 列出某厂商的季度序列(按时间倒序) */
export function vendorQuarters(vendorId) {
  const db = ensureSeeded();
  return (db.quarters || []).filter(x => x.vendorId === vendorId)
    .sort((a, b) => (b.year - a.year) || (b.q - a.q));
}
/** 全部季度(前端一次取回) */
export function allQuarters() { const db = ensureSeeded(); return db.quarters || []; }
/** 新增或覆盖一条季度记录。手工改过的记录不会被自动导入覆盖(manual 保护),与 fin_db 一致。 */
export function upsertVendorQuarter(rec, { manual = false } = {}) {
  if (!rec || !rec.vendorId || !rec.year || !rec.q) return { ok: false, error: "缺少 vendorId/year/q" };
  const db = ensureSeeded();
  db.quarters = db.quarters || [];
  const id = `${rec.vendorId}-${rec.year}Q${rec.q}`;
  const i = db.quarters.findIndex(x => x.id === id);
  if (i >= 0) {
    if (db.quarters[i].manual && !manual) return { ok: false, skipped: "manual" };
    db.quarters[i] = { ...db.quarters[i], ...cleanVQ(rec), manual, updatedAt: now() };
  } else {
    db.quarters.push({ id, vendorId: rec.vendorId, kind: rec.kind || "", year: +rec.year, q: +rec.q, ...cleanVQ(rec), manual, updatedAt: now() });
  }
  save(db);
  return { ok: true, id };
}
export function delVendorQuarter(id) {
  const db = ensureSeeded();
  const n = (db.quarters || []).length;
  db.quarters = (db.quarters || []).filter(x => x.id !== id);
  const ok = db.quarters.length < n; if (ok) save(db); return ok;
}
