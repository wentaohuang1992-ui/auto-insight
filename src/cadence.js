// 上市节奏:博查按品牌/车系细搜 + DeepSeek(强模型)整理某大类 2026 全年新车/改款列表。
import { research } from "./research.js";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"; // 用不思考的 flash,直接稳定出 JSON

const QUERIES = {
  yinwang: [
    "问界 2026 新车 改款 上市", "智界 2026 新车 改款 上市", "享界 2026 新车 上市", "尊界 2026 新车 上市", "尚界 2026 新车 上市",
    "阿维塔 2026 新车 改款 上市", "奕境 猛士 2026 上市", "启境 2026 上市", "华为 乾崑智驾 2026 新车 深蓝 岚图 上市"
  ],
  xinshili: [
    "蔚来 乐道 2026 新车 改款 上市", "小鹏 2026 新车 改款 上市", "理想 2026 新车 改款 上市", "零跑 2026 新车 改款 上市", "小米汽车 2026 新车 上市"
  ],
  chuantong: [
    "比亚迪 2026 新车 改款 上市", "吉利 银河 2026 新能源 上市", "极氪 领克 2026 新车 上市", "长安 启源 深蓝 2026 上市", "长城 哈弗 坦克 魏牌 2026 新能源 上市",
    "奇瑞 风云 iCAR 星途 2026 新能源 上市", "广汽 埃安 昊铂 2026 上市", "上汽 智己 荣威 MG 2026 新能源 上市", "北汽 极狐 2026 上市", "东风 岚图 eπ 2026 上市", "一汽红旗 2026 新能源 上市"
  ]
};

function schemaFor(cat) {
  const rule = cat === "yinwang"
    ? `每辆车标注 group:hongmeng(问界/智界/享界/尊界/尚界)、lianhe(阿维塔/奕境含猛士/启境)、hi(其他搭载华为乾崑智驾的车型,如深蓝/岚图等)。`
    : cat === "xinshili"
      ? `brand 必须是:蔚来、小鹏、理想、零跑、小米 之一(蔚来含乐道)。group 留空。`
      : `brand 必须是:比亚迪、吉利、长安、长城、奇瑞、广汽、上汽、北汽、东风、一汽红旗、其他 之一(子品牌归到对应集团,如极氪/领克→吉利、智己/荣威→上汽、埃安/昊铂→广汽、极狐→北汽、岚图→东风);不要包含已并入引望的合作车型(智界/尚界/启境/享界/尊界/奕境)。group 留空。`;
  return `请据资料**尽量完整**地整理该范围 2026 年的新车与改款车上市节奏,把资料中提到的已上市、预售、即将上市、官宣车型都收录,宁可多列不要遗漏。${rule}
JSON:{"overview":"该类别2026全年上市节奏一段话概述(80字内)","cars":[{"model":"车型名","brand":"品牌","group":"引望填hongmeng/lianhe/hi,否则留空字符串","month":1到12数字,"date":"如3月","kind":"新车或改款","price":"价格区间或留空","orders":"小定/大定/销量或暂无公开数据","note":"一句话亮点30字内","sources":[{"title":"来源名","url":"真实URL"}]}]}`;
}

export async function generateCadence(cat) {
  const data = await research({
    queries: QUERIES[cat], schema: schemaFor(cat),
    freshness: "noLimit", count: 12, summaryLen: 700, maxTokens: 8000, model: MODEL
  });
  if (!data || !Array.isArray(data.cars)) throw new Error("上市节奏解析失败");
  return { overview: data.overview || "", cars: data.cars };
}
