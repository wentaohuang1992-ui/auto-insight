// 上市节奏:逐个品牌/车系单独检索+抽取(含下半年前瞻词、未定月份按"预计"处理),再合并成大类结果。
import { research } from "./research.js";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const LEAVES = {
  yinwang: [
    { brand: "问界", group: "hongmeng", q: ["问界 2026 新车 改款 上市", "问界 2026 下半年 新车 规划 预告"] },
    { brand: "智界", group: "hongmeng", q: ["智界 2026 新车 改款 上市", "智界 2026 下半年 新车 规划"] },
    { brand: "享界", group: "hongmeng", q: ["享界 2026 新车 上市 规划 预告"] },
    { brand: "尊界", group: "hongmeng", q: ["尊界 2026 新车 上市 规划 预告"] },
    { brand: "尚界", group: "hongmeng", q: ["尚界 2026 新车 上市 规划 预告"] },
    { brand: "阿维塔", group: "lianhe", q: ["阿维塔 2026 新车 改款 上市", "阿维塔 2026 下半年 规划 预告"] },
    { brand: "奕境", group: "lianhe", q: ["奕境 猛士 东风 引望 2026 上市 规划"] },
    { brand: "启境", group: "lianhe", q: ["启境 广汽 引望 2026 上市 规划"] },
    { group: "hi", q: ["昊铂 华为乾崑 2026 新车 上市", "岚图 猛士 华为乾崑 2026 上市 规划", "深蓝 华为乾崑版 2026 上市", "华为乾崑 HI模式 在售车型 昊铂 岚图 深蓝 价格"] }
  ],
  xinshili: [
    { brand: "蔚来", q: ["蔚来 乐道 2026 新车 改款 上市", "蔚来 2026 下半年 新车 规划 预告"] },
    { brand: "小鹏", q: ["小鹏 2026 新车 改款 上市", "小鹏 2026 下半年 新车 规划 预告"] },
    { brand: "理想", q: ["理想 2026 新车 改款 上市", "理想 2026 下半年 新车 规划 预告"] },
    { brand: "零跑", q: ["零跑 2026 新车 改款 上市", "零跑 2026 下半年 新车 规划 预告"] },
    { brand: "小米", q: ["小米汽车 2026 新车 上市", "小米汽车 2026 下半年 新车 规划 预告"] }
  ],
  chuantong: [
    { brand: "比亚迪", q: ["比亚迪 2026 新车 改款 上市", "比亚迪 2026 下半年 新车 规划 预告"] },
    { brand: "吉利", q: ["吉利 银河 极氪 领克 2026 新车 上市", "吉利 2026 下半年 新能源 规划 预告"] },
    { brand: "长安", q: ["长安 启源 深蓝 2026 新车 上市", "长安 2026 下半年 新能源 规划 预告"] },
    { brand: "长城", q: ["长城 哈弗 坦克 魏牌 欧拉 2026 新能源 上市", "长城 2026 下半年 新车 规划 预告"] },
    { brand: "奇瑞", q: ["奇瑞 风云 iCAR 星途 2026 新能源 上市", "奇瑞 2026 下半年 新车 规划 预告"] },
    { brand: "广汽", q: ["广汽 埃安 昊铂 2026 新车 上市", "广汽 2026 下半年 新能源 规划 预告"] },
    { brand: "上汽", q: ["上汽 智己 荣威 MG 2026 新能源 上市", "上汽 2026 下半年 新车 规划 预告"] },
    { brand: "北汽", q: ["北汽 极狐 2026 新车 上市 规划 预告"] },
    { brand: "东风", q: ["东风 岚图 eπ 2026 新能源 上市", "东风 2026 下半年 新车 规划 预告"] },
    { brand: "一汽红旗", q: ["一汽红旗 2026 新能源 新车 上市 规划 预告"] }
  ]
};

function leafSchema(leaf) {
  const who = leaf.brand || "华为乾崑 HI 模式车型(广汽昊铂、东风岚图、东风猛士、深蓝华为乾崑版,以及其它搭载华为乾崑 ADS、但不属于鸿蒙智行(问界/智界/享界/尊界/尚界)、也不属于阿维塔系联合共创的车型)";
  return `请据资料整理【${who}】的两部分:
A. cars:${who} 2026 年的新车与改款车,**尽量列全**,涵盖已上市/预售/即将上市/已官宣规划,**务必含下半年**;**包含该品牌的全部子品牌**(例:蔚来含乐道、萤火虫;吉利含银河、极氪、领克;长安含深蓝、启源;长城含哈弗、坦克、魏牌、欧拉;广汽含埃安、昊铂;上汽含智己、荣威、MG;东风含岚图、eπ;奇瑞含风云、iCAR、星途)。对只透露到季度或半年的(如第三季度、上半年、年底),也要收录:按季度起始月估 month、estimated=true、date 写"预计Q3""预计下半年"等。确无依据不编造。
B. lineup:${who}(含子品牌)**当前全部在售车型**(产品谱系,含非2026上市的存量车型),每款给 body(轿车/SUV/MPV,轿跑/旅行归轿车、皮卡归SUV)、price(起售价或区间);若该车型 2026 有新车或改款,填 launchKind(新车/改款)与 launchDate(如3月),否则留空。
JSON:{"cars":[{"model":"车型名","brand":"品牌","month":1到12数字,"date":"如3月或预计Q3","kind":"新车或改款","estimated":true或false,"hi":true或false,"price":"价格区间或留空","orders":"小定/大定/销量或暂无公开数据","note":"亮点30字内","sources":[{"title":"来源名","url":"真实URL"}]}],"lineup":[{"model":"车型名","body":"轿车/SUV/MPV","price":"价格","hi":true或false,"launchKind":"新车/改款 或留空","launchDate":"如3月 或留空"}]}
说明:若该车型搭载**华为乾崑智驾(华为 ADS / HI 模式 / 鸿蒙智行)**,hi 设为 true,否则 false(如昊铂A800、岚图/猛士华为版、深蓝华为版等均为 true)。`;
}

async function pool(items, limit, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

const OVERVIEW = {
  yinwang: "引望车系(鸿蒙智行 + 联合共创 + HI智驾)2026 全年上市节奏。",
  xinshili: "造车新势力 2026 全年上市节奏。",
  chuantong: "传统车企(自有品牌)2026 全年上市节奏。"
};

export async function generateCadence(cat) {
  const leaves = LEAVES[cat];
  const results = await pool(leaves, 5, async (leaf) => {
    try {
      const q = leaf.brand ? [...leaf.q, `${leaf.brand} 在售车型 全部 价格 轿车 SUV MPV`] : leaf.q;
      const gn = [leaf.brand ? `${leaf.brand} 2026 新车 改款 上市 规划` : "华为 乾崑智驾 2026 新车 上市 规划"];
      const d = await research({ queries: q, schema: leafSchema(leaf), freshness: "noLimit", count: 10, summaryLen: 600, maxTokens: 5000, model: MODEL, gnewsQueries: gn, gnewsWhen: "" });
      const stamp = (c) => ({ ...c, brand: leaf.brand || c.brand, group: leaf.group || "" });
      return { cars: (Array.isArray(d.cars) ? d.cars : []).map(stamp), lineup: (Array.isArray(d.lineup) ? d.lineup : []).map(stamp) };
    } catch (e) { console.error("[cadence]", cat, leaf.brand || leaf.group, e.message); return { cars: [], lineup: [] }; }
  });
  return { overview: OVERVIEW[cat], cars: results.flatMap((r) => r.cars), lineup: results.flatMap((r) => r.lineup) };
}
