// ============================================================
// 🧰 玄学工具实验室（R6-5）· 纯数据层
//
// 提供四类确定性工具数据：
//   1. 二十四山（罗盘模拟器）：方位角 / 五行 / 类别（天干·地支·四维）/ 后天八卦宫位
//   2. 二十四节气（节气工具）：名称 / 太阳黄经 / 节·气分类 / 农历月份参考
//   3. 五行相生相克环（五行实验器）
//   4. 时辰对照（干支历工具）
//
// 全部为传统文化知识的确定性记录，用于「学习与观察」，
// 不把任何内容包装成预测或因果结论。
// ============================================================

// ── 二十四山（从正北子山起，顺时针，每山 15 度）────────────
// type: 'stem' 天干 / 'branch' 地支 / 'corner' 四维
// palace: 后天八卦宫位
export const MOUNTAINS = [
  { name: '子', angle: 0, element: '水', type: 'branch', palace: '坎', desc: '正北，二十四山的起点与子午线的「子」端。' },
  { name: '癸', angle: 15, element: '水', type: 'stem', palace: '坎', desc: '正北偏东之山，天干癸水。' },
  { name: '丑', angle: 30, element: '土', type: 'branch', palace: '艮', desc: '东北偏北之山，丑为阴土，藏己癸辛三干。' },
  { name: '艮', angle: 45, element: '土', type: 'corner', palace: '艮', desc: '东北（四维之一），艮为山，为东北之维。' },
  { name: '寅', angle: 60, element: '木', type: 'branch', palace: '艮', desc: '东北偏东，寅木，三阳开泰之月支。' },
  { name: '甲', angle: 75, element: '木', type: 'stem', palace: '震', desc: '正东偏北，天干甲木。' },
  { name: '卯', angle: 90, element: '木', type: 'branch', palace: '震', desc: '正东，卯木，春分之位。' },
  { name: '乙', angle: 105, element: '木', type: 'stem', palace: '震', desc: '正东偏南，天干乙木。' },
  { name: '辰', angle: 120, element: '土', type: 'branch', palace: '巽', desc: '东南偏东之山，辰为阳土，藏戊乙癸三干。' },
  { name: '巽', angle: 135, element: '木', type: 'corner', palace: '巽', desc: '东南（四维之一），巽为风。' },
  { name: '巳', angle: 150, element: '火', type: 'branch', palace: '巽', desc: '东南偏南之山，巳为阴火，藏丙戊庚三干。' },
  { name: '丙', angle: 165, element: '火', type: 'stem', palace: '离', desc: '正南偏东，天干丙火。' },
  { name: '午', angle: 180, element: '火', type: 'branch', palace: '离', desc: '正南，午火，夏至之位。' },
  { name: '丁', angle: 195, element: '火', type: 'stem', palace: '离', desc: '正南偏西，天干丁火。' },
  { name: '未', angle: 210, element: '土', type: 'branch', palace: '坤', desc: '西南偏南之山，未为阴土，藏己丁乙三干。' },
  { name: '坤', angle: 225, element: '土', type: 'corner', palace: '坤', desc: '西南（四维之一），坤为地。' },
  { name: '申', angle: 240, element: '金', type: 'branch', palace: '坤', desc: '西南偏西之山，申为阳金，藏庚壬戊三干。' },
  { name: '庚', angle: 255, element: '金', type: 'stem', palace: '兑', desc: '正西偏南，天干庚金。' },
  { name: '酉', angle: 270, element: '金', type: 'branch', palace: '兑', desc: '正西，酉金，秋分之位。' },
  { name: '辛', angle: 285, element: '金', type: 'stem', palace: '兑', desc: '正西偏北，天干辛金。' },
  { name: '戌', angle: 300, element: '土', type: 'branch', palace: '乾', desc: '西北偏西之山，戌为阳土，藏戊辛丁三干。' },
  { name: '乾', angle: 315, element: '金', type: 'corner', palace: '乾', desc: '西北（四维之一），乾为天。' },
  { name: '亥', angle: 330, element: '水', type: 'branch', palace: '乾', desc: '西北偏北之山，亥为阴水，藏壬甲二干。' },
  { name: '壬', angle: 345, element: '水', type: 'stem', palace: '坎', desc: '正北偏西，天干壬水。' },
]

export const MOUNTAIN_BY_NAME = MOUNTAINS.reduce((acc, m) => {
  acc[m.name] = m
  return acc
}, {})

// 类别中文名
export const MOUNTAIN_TYPE_LABEL = { stem: '天干', branch: '地支', corner: '四维' }

// ── 二十四节气（太阳黄经）────────────────────────────────
// kind: '节' 月柱分界 / '气' 中气
export const SOLAR_TERMS = [
  { name: '立春', angle: 315, kind: '节', note: '正月节，春季开始，年柱分界。' },
  { name: '雨水', angle: 330, kind: '气', note: '正月之中，降水渐增。' },
  { name: '惊蛰', angle: 345, kind: '节', note: '二月节，春雷始鸣。' },
  { name: '春分', angle: 0, kind: '气', note: '昼夜平分，仲春之月。' },
  { name: '清明', angle: 15, kind: '节', note: '三月节，气清景明。' },
  { name: '谷雨', angle: 30, kind: '气', note: '雨生百谷。' },
  { name: '立夏', angle: 45, kind: '节', note: '四月节，夏季开始。' },
  { name: '小满', angle: 60, kind: '气', note: '麦粒渐满。' },
  { name: '芒种', angle: 75, kind: '节', note: '五月节，有芒之种可稼。' },
  { name: '夏至', angle: 90, kind: '气', note: '日长之极，仲夏之月。' },
  { name: '小暑', angle: 105, kind: '节', note: '六月节，暑气渐盛。' },
  { name: '大暑', angle: 120, kind: '气', note: '一年中最热时段。' },
  { name: '立秋', angle: 135, kind: '节', note: '七月节，秋季开始。' },
  { name: '处暑', angle: 150, kind: '气', note: '暑气渐止。' },
  { name: '白露', angle: 165, kind: '节', note: '八月节，露凝而白。' },
  { name: '秋分', angle: 180, kind: '气', note: '昼夜平分，仲秋之月。' },
  { name: '寒露', angle: 195, kind: '节', note: '九月节，露寒将凝。' },
  { name: '霜降', angle: 210, kind: '气', note: '气肃而凝，露结为霜。' },
  { name: '立冬', angle: 225, kind: '节', note: '十月节，冬季开始。' },
  { name: '小雪', angle: 240, kind: '气', note: '始雪而小。' },
  { name: '大雪', angle: 255, kind: '节', note: '十一月节，雪盛。' },
  { name: '冬至', angle: 270, kind: '气', note: '日短之极，一阳来复。' },
  { name: '小寒', angle: 285, kind: '节', note: '十二月节，寒未至极。' },
  { name: '大寒', angle: 300, kind: '气', note: '一年最冷时段，岁终之气。' },
]

export const TERM_BY_NAME = SOLAR_TERMS.reduce((acc, t) => {
  acc[t.name] = t
  return acc
}, {})

// ── 五行生克环（与 lib/constants 一致，供实验器展示）──────
export const ELEMENT_ORDER = ['木', '火', '土', '金', '水']
export const GENERATES_RING = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
export const OVERCOMES_RING = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

// 五行基础意象（学习性说明，非唯一答案）
export const ELEMENT_IMAGERY = {
  木: { symbol: '🌳', desc: '生发、条达；传统取象为草木之性。', season: '春' },
  火: { symbol: '🔥', desc: '炎热、向上；传统取象为光明之性。', season: '夏' },
  土: { symbol: '⛰️', desc: '承载、化育；传统取象为厚土之性。', season: '四季' },
  金: { symbol: '⚙️', desc: '肃杀、收敛；传统取象为金属之性。', season: '秋' },
  水: { symbol: '💧', desc: '润下、寒凉；传统取象为流水之性。', season: '冬' },
}

// ── 时辰对照（十二时辰 → 小时段）────────────────────────
export const SHICHEN = [
  { name: '子时', hours: '23:00–01:00', branch: '子', note: '夜半，一阳初生。' },
  { name: '丑时', hours: '01:00–03:00', branch: '丑', note: '鸡鸣，丑土当令。' },
  { name: '寅时', hours: '03:00–05:00', branch: '寅', note: '平旦，三阳开泰。' },
  { name: '卯时', hours: '05:00–07:00', branch: '卯', note: '日出，卯木当令。' },
  { name: '辰时', hours: '07:00–09:00', branch: '辰', note: '食时，辰土当令。' },
  { name: '巳时', hours: '09:00–11:00', branch: '巳', note: '隅中，巳火当令。' },
  { name: '午时', hours: '11:00–13:00', branch: '午', note: '日中，午火当令。' },
  { name: '未时', hours: '13:00–15:00', branch: '未', note: '日昳，未土当令。' },
  { name: '申时', hours: '15:00–17:00', branch: '申', note: '晡时，申金当令。' },
  { name: '酉时', hours: '17:00–19:00', branch: '酉', note: '日入，酉金当令。' },
  { name: '戌时', hours: '19:00–21:00', branch: '戌', note: '黄昏，戌土当令。' },
  { name: '亥时', hours: '21:00–23:00', branch: '亥', note: '人定，亥水当令。' },
]
