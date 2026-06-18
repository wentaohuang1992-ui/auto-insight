// 上市节奏:博查搜索 + DeepSeek 整理出某大类 2026 全年新车/改款列表(带分类标签)。
import { research } from "./research.js";

const QUERIES = {
  yinwang: ["问界 2026 新车 改款 上市 时间", "智界 享界 尊界 尚界 2026 上市", "阿维塔 奕境 启境 2026 上市 猛士", "华为 乾崑智驾 2026 新车 上市"],
  xinshili: ["蔚来 2026 新车 改款 上市", "小鹏 2026 新车 上市", "理想 2026 新车 上市", "零跑 2026 新车 上市", "小米汽车 2026 新车 上市"],
  chuantong: ["比亚迪 2026 新车 改款 上市", "吉利 银河 极氪 2026 上市", "长安 长城 2026 新能源 上市", "奇瑞 广汽 上汽 2026 新能源 自有品牌 上市", "北汽 东风 一汽红旗 2026 新能源 上市"]
};

function schemaFor(cat) {
  const rule = cat === "yinwang"
    ? `每辆车标注 group:hongmeng(问界/智界/享界/尊界/尚界)、lianhe(阿维塔/奕境含猛士/启境)、hi(其他搭载华为乾崑智驾的车型)。`
    : cat === "xinshili"
      ? `brand 必须是:蔚来、小鹏、理想、零跑、小米 之一。group 留空。`
      : `brand 必须是:比亚迪、吉利、长安、长城、奇瑞、广汽、上汽、北汽、东风、一汽红旗、其他 之一;不要包含已并入引望的合作车型(智界/尚界/启境/享界/尊界/奕境)。group 留空。`;
  return `请据资料整理该范围 2026 年的新车与改款车上市节奏。${rule}
JSON:{"overview":"该类别2026全年上市节奏一段话概述(80字内)","cars":[{"model":"车型名","brand":"品牌","group":"引望填hongmeng/lianhe/hi,否则留空字符串","month":1到12数字,"date":"如3月","kind":"新车或改款","price":"价格区间或留空","orders":"小定/大定/销量或暂无公开数据","note":"一句话亮点30字内","sources":[{"title":"来源名","url":"真实URL"}]}]}`;
}

export async function generateCadence(cat) {
  const data = await research({ queries: QUERIES[cat], schema: schemaFor(cat), freshness: "noLimit", count: 10, maxTokens: 6000 });
  if (!data || !Array.isArray(data.cars)) throw new Error("上市节奏解析失败");
  return { overview: data.overview || "", cars: data.cars };
}
