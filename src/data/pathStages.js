// ============================================================
// 🛤️ 求学之路 · 六段主线（R7）
// 在现有 390 节点之上叠加「组织层」：不新增知识、不改节点数据。
// 每段约 12 个核心必修节点，其余 318 个节点为选修（仍全部可自由学习）。
// 目标等级对齐学徒等级 L0-L6。全部确定性。
// ============================================================

export const PATH_STAGES = [
  {
    key: 's1',
    order: 1,
    name: '认知启蒙',
    emoji: '🌱',
    targetLevel: 'L1',
    desc: '先知道每个体系「是什么」，同时学会把「事实」和「解释」分开。这是所有术数学习的地基。',
    coreNodeIds: [
      'obs-fact', 'obs-extract', 'unc-unknown',
      'ic-what', 'ic-zhouyi',
      'yy-concept', 'wx-concept',
      'fs-what',
      'qm-b1', 'lr-o1', 'ty-h1',
      'hs-pq-yinyang',
    ],
  },
  {
    key: 's2',
    order: 2,
    name: '体系基础',
    emoji: '🧱',
    targetLevel: 'L2',
    desc: '掌握阴阳、五行、干支、八卦这套「字母表」。看不懂字母，后面的一切都是猜。',
    coreNodeIds: [
      'yy-property', 'yy-cycle', 'wx-elements', 'wx-generate', 'wx-restrain',
      'sb-stems', 'sb-branches',
      'yg-yao', 'bg-genesis', 'yg-deep',
      'fs-yinyang', 'hs-pq-wuxing',
    ],
  },
  {
    key: 's3',
    order: 3,
    name: '结构识别',
    emoji: '🔍',
    targetLevel: 'L3',
    desc: '学会看懂「盘」和「卦」的结构：四柱、六爻、上下卦、六位阶梯。能读出基本信息，而不是看热闹。',
    coreNodeIds: [
      'obs-vars', 'rea-hypo', 'rea-evidence',
      'sb-pillar', 'sb-month', 'tg-source',
      'hx-generation', 'hx-lines', 'hx-upper-lower', 'hx-naming', 'yp-six',
      'fs-fangwei',
    ],
  },
  {
    key: 's4',
    order: 4,
    name: '规则应用',
    emoji: '🛠️',
    targetLevel: 'L4',
    desc: '把规则用起来：判断日主强弱、读爻位得位与中、主动找反例。从「看懂」走向「能判断」。',
    coreNodeIds: [
      'rea-counter', 'rea-alternative', 'unc-insufficient',
      'tg-position', 'hs-concept',
      'ds-concept', 'ds-ling', 'ds-di', 'ds-combine',
      'yg-position', 'yp-dewei', 'yp-zhong',
    ],
  },
  {
    key: 's5',
    order: 5,
    name: '综合进阶',
    emoji: '⚖️',
    targetLevel: 'L5',
    desc: '多变量综合：格局、用神、卦辞、爻辞、十翼。面对一个完整案例，知道从哪下手、如何整合。',
    coreNodeIds: [
      'bias-single', 'unc-calibration',
      'ds-count', 'pt-concept', 'pt-judge', 'ug-concept', 'ug-xi-ji',
      'hx-network', 'hg-read-card', 'ht-guaci', 'ht-yaoci', 'yz-overview',
    ],
  },
  {
    key: 's6',
    order: 6,
    name: '独立研究',
    emoji: '🎓',
    targetLevel: 'L6',
    desc: '流派差异、冲突信息、独立分析。面对陌生案例无需提示，能建立自己的分析路径并说明依据——出师前的最后一关。',
    coreNodeIds: [
      'pt-schools', 'ug-schools', 'ug-conflict',
      'sy-method', 'sy-info', 'sy-conflict', 'sy-multi',
      'hc-benbian', 'hc-opposite',
      'yx-overview', 'yx-compare',
      'qm-h4',
    ],
  },
]

// 节点 → 段位反查表（构建时生成，确定性）
export const CORE_NODE_TO_STAGE = PATH_STAGES.reduce((acc, s) => {
  for (const id of s.coreNodeIds) acc[id] = s.key
  return acc
}, {})

export const ALL_CORE_IDS = PATH_STAGES.flatMap((s) => s.coreNodeIds)

// 某节点是否核心必修；返回所属段 key 或 null
export function stageOfNode(nodeId) {
  return CORE_NODE_TO_STAGE[nodeId] || null
}

export function getStage(key) {
  return PATH_STAGES.find((s) => s.key === key) || null
}

export const PATH_STAGE_KEYS = PATH_STAGES.map((s) => s.key)
