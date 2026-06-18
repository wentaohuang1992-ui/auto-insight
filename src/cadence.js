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
    { group: "hi", q: ["华为 乾崑智驾 2026 新车 上市", "深蓝 岚图 乾崑智驾 2026 新车 上市 规划"] }
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
  const who = leaf.brand || "搭载华为乾崑智驾、且不属于鸿蒙智行/联合共创的其他车型";
  return `请据资料**尽量完整**列出【${who}】2026 年的新车与改款车,涵盖已上市、预售、即将上市、已官宣规划,**务必包含下半年(7-12月)**。若某车型已官宣但未定具体上市月份,请依据资料里的季度/时间线索估一个最可能的月份,并把 estimated 设为 true、date 写成"预计X月";资料中确无依据的不要编造。
JSON:{"cars":[{"model":"车型名","brand":"品牌","month":1到12数字,"date":"如3月或预计10月","kind":"新车或改款","estimated":true或false,"price":"价格区间或留空","orders":"小定/大定/销量或暂无公开数据","note":"亮点30字内","sources":[{"title":"来源名","url":"真实URL"}]}]}`;
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
      const d = await research({ queries: leaf.q, schema: leafSchema(leaf), freshness: "noLimit", count: 10, summaryLen: 600, maxTokens: 3000, model: MODEL });
      const cars = Array.isArray(d.cars) ? d.cars : [];
      return cars.map((c) => ({ ...c, brand: leaf.brand || c.brand, group: leaf.group || "" }));
    } catch (e) { console.error("[cadence]", cat, leaf.brand || leaf.group, e.message); return []; }
  });
  return { overview: OVERVIEW[cat], cars: results.flat() };
}
