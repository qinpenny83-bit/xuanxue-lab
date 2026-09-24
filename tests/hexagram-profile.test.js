// ============================================================
// 64卦深度档案数据模型（R2-1）测试
// 验证：64卦完整 / 384爻可独立索引 / 卦序·上下卦正确 /
//       爻位关系确定性计算 / 原典不编造（null=暂无可靠整理）/
//       十翼·解释传统走引用（nodeId 可解析，不复制知识）。
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  HEXAGRAM_PROFILES,
  ALL_YAO,
  YAO_BY_ID,
  getHexagramProfile,
  getYaoById,
  getYao,
  analyzeYao,
  POSITIONS,
  POSITION_MEANING,
  TEN_WINGS_REF,
  TRADITION_REF,
} from '../src/data/iching/hexagramProfile'
import { getCurriculumNode } from '../src/data/curriculum'
import { BAGUA } from '../src/data/iching/hexagrams-data'

describe('64卦深度档案 · 数据完整度', () => {
  it('64 卦全部存在，卦序 1..64 连续且名称唯一', () => {
    expect(HEXAGRAM_PROFILES).toHaveLength(64)
    const seqs = HEXAGRAM_PROFILES.map((p) => p.number).sort((a, b) => a - b)
    expect(seqs[0]).toBe(1)
    expect(seqs[63]).toBe(64)
    expect(new Set(seqs)).toHaveLength(64)

    const names = HEXAGRAM_PROFILES.map((p) => p.name)
    expect(new Set(names)).toHaveLength(64)
  })

  it('上下卦都存在且匹配 BAGUA 字典', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(BAGUA[p.upperTrigram], `${p.name} 上卦 ${p.upperTrigram} 缺失`).toBeTruthy()
      expect(BAGUA[p.lowerTrigram], `${p.name} 下卦 ${p.lowerTrigram} 缺失`).toBeTruthy()
      expect(p.upperInfo?.nature, `${p.name} 上卦 nature`).toBeTruthy()
      expect(p.lowerInfo?.nature, `${p.name} 下卦 nature`).toBeTruthy()
    }
  })

  it('每卦正好 6 爻 → 总计 384 爻，每条爻可独立索引', () => {
    expect(ALL_YAO).toHaveLength(384)
    expect(Object.keys(YAO_BY_ID)).toHaveLength(384)
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.yao, `${p.name} 爻缺失`).toHaveLength(6)
      for (let i = 0; i < 6; i++) {
        const y = p.yao[i]
        expect(y.id).toBe(`hx-${p.number}-${i}`)
        expect(getYaoById(y.id), `${y.id} 无法独立索引`).toBe(y)
        expect(y.position).toBe(i)
        expect(y.positionLabel).toBe(POSITIONS[i])
      }
    }
  })

  it('按序号 / 名称 / 六爻串三种方式都能取到同一卦', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(getHexagramProfile(p.number)).toBe(p)
      expect(getHexagramProfile(p.name)).toBe(p)
      expect(getHexagramProfile(p.binaryPattern)).toBe(p)
    }
  })

  it('getYao 能按「卦 + 位置」取到单爻；越界返回 null', () => {
    expect(getYao('乾', 0).name).toBe('初九')
    expect(getYao(1, 4).name).toBe('九五')
    expect(getYao('111111', 5).name).toBe('上九')
    expect(getYao('乾', -1)).toBeNull()
    expect(getYao('乾', 6)).toBeNull()
    expect(getYao('不存在的卦', 0)).toBeNull()
  })
})

describe('64卦深度档案 · 原典层（不编造）', () => {
  it('每一卦都有卦辞原文', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.guaci, `${p.name} 缺卦辞`).toBeTruthy()
      expect(typeof p.guaci).toBe('string')
    }
  })

  it('乾 / 坤 / 既济 / 未济 卦辞与通行本一致', () => {
    expect(getHexagramProfile('乾').guaci).toBe('元亨利贞。')
    expect(getHexagramProfile('坤').guaci).toBe('元亨，利牝马之贞。君子有攸往，先迷后得主，利。西南得朋，东北丧朋。安贞吉。')
    expect(getHexagramProfile('既济').guaci).toBe('亨小，利贞。初吉终乱。')
    expect(getHexagramProfile('未济').guaci).toBe('亨。小狐汔济，濡其尾，无攸利。')
  })

  it('384 爻爻辞全文已接入（通行本），抽样核对原文', () => {
    expect(getYao('乾', 0).originalText).toBe('潜龙勿用')
    expect(getYao('坤', 0).originalText).toBe('履霜，坚冰至')
    expect(getYao('既济', 5).originalText).toBe('濡其首，厉')
    expect(getYao('屯', 1).originalText).toBe('屯如邅如，乘马班如。匪寇婚媾，女子贞不字，十年乃字')
  })

  it('384 爻爻辞已全部接入；彖传/系辞全文仍待核对为 null（不编造）', () => {
    for (const p of HEXAGRAM_PROFILES) {
      const filled = p.yao.filter((y) => typeof y.originalText === 'string' && y.originalText.length > 0)
      expect(filled.length, `${p.name} 应六爻全文齐备`).toBe(6)
      // 彖传、系辞全文仍未逐卦核对：必须为 null，不能出现占位空话
      expect(p.tenWings.tuan.text).toBeNull()
      expect(p.tenWings.xici.text).toBeNull()
    }
  })

  it('每一爻都有位置意义（positionMeaning），不空', () => {
    for (const y of ALL_YAO) {
      expect(POSITION_MEANING[y.position], `positionMeaning 位置 ${y.position} 缺失`).toBeTruthy()
      expect(y.positionMeaning).toBeTruthy()
    }
  })
})

describe('64卦深度档案 · 确定性爻位关系引擎', () => {
  it('乾卦：九五 得位+中+中正，初↔四、二↔五 皆同气敌应', () => {
    const jiuwu = getYao('乾', 4)
    expect(jiuwu.yang).toBe(true)
    expect(jiuwu.dewei).toBe(true) // 阳爻居阳位（五）
    expect(jiuwu.zhong).toBe(true) // 五为中位
    expect(jiuwu.zhongzheng).toBe(true) // 又中又正
    expect(jiuwu.gangrou).toBe('刚')
    expect(jiuwu.innerOuter).toBe('外卦（上卦）')

    const chujiu = getYao('乾', 0)
    expect(chujiu.ying.partner).toBe(3) // 初 ↔ 四
    expect(chujiu.ying.favorable).toBe(false) // 阳阳敌应

    const jiuerying = getYao('乾', 1).ying
    expect(jiuerying.partner).toBe(4) // 二 ↔ 五
    expect(jiuerying.favorable).toBe(false)
  })

  it('乾卦九二：阳居阴位＝失位，但仍处中位（中而不正）', () => {
    const jiuer = getYao('乾', 1)
    expect(jiuer.dewei).toBe(false)
    expect(jiuer.zhong).toBe(true)
    expect(jiuer.zhongzheng).toBe(false)
  })

  it('坤卦六二：阴居阴位＝得位+中+中正；六五：得中而失位', () => {
    const liuer = getYao('坤', 1)
    expect(liuer.yang).toBe(false)
    expect(liuer.dewei).toBe(true)
    expect(liuer.zhongzheng).toBe(true)

    const liuwu = getYao('坤', 4)
    expect(liuwu.dewei).toBe(false) // 阴居阳位（五）
    expect(liuwu.zhong).toBe(true)
    expect(liuwu.zhongzheng).toBe(false)
  })

  it('既济六爻全部「当位」：阳爻居阳位、阴爻居阴位', () => {
    // 既济 101010：初阳、二阴、三阳、四阴、五阳、上阴 → 全得位
    for (let i = 0; i < 6; i++) {
      expect(getYao('既济', i).dewei, `既济 ${POSITIONS[i]}爻`).toBe(true)
    }
  })

  it('未济六爻全部「不当位」', () => {
    for (let i = 0; i < 6; i++) {
      expect(getYao('未济', i).dewei, `未济 ${POSITIONS[i]}爻`).toBe(false)
    }
  })

  it('analyzeYao 输出字段齐全（承/乘/比 结构可计算）', () => {
    const a = analyzeYao('101010', 2) // 既济 三爻（阳）
    expect(a).toHaveProperty('ying')
    expect(a).toHaveProperty('bi')
    expect(a).toHaveProperty('cheng')
    expect(a).toHaveProperty('ling')
    expect(a.lineType).toBe('阳')
    expect(a.innerOuter).toBe('内卦（下卦）')
    expect(a.dewei).toBe(true) // 三为阳位
  })
})

describe('64卦深度档案 · 卦间关系（错/综/互，标传统）', () => {
  it('乾错坤、坤错乾；关系数据结构含 tradition 与 note', () => {
    const rel = getHexagramProfile('乾').relations
    const cuo = rel.find((r) => r.type === '错卦')
    expect(cuo.target).toBe(2)
    expect(cuo.targetName).toBe('坤为地')
    expect(cuo.tradition).toBe('传统易学')
    expect(cuo.note).toBeTruthy()
  })

  it('泰综否、既济综未济、未济综既济', () => {
    const tai = getHexagramProfile('泰').relations
    expect(tai.find((r) => r.type === '综卦').targetName).toBe('天地否')

    const jiji = getHexagramProfile('既济').relations
    expect(jiji.find((r) => r.type === '综卦').targetName).toBe('火水未济')

    const weiji = getHexagramProfile('未济').relations
    expect(weiji.find((r) => r.type === '综卦').targetName).toBe('水火既济')
  })

  it('互卦：遁互姤', () => {
    const dun = getHexagramProfile('遁').relations
    expect(dun.find((r) => r.type === '互卦').targetName).toBe('天风姤')
  })
})

describe('64卦深度档案 · 十翼与解释传统走引用（不做重复知识）', () => {
  it('十翼引用的 nodeId 全部能在课程目录中解析', () => {
    for (const key of Object.keys(TEN_WINGS_REF)) {
      const ref = TEN_WINGS_REF[key]
      expect(getCurriculumNode(ref.node), `十翼节点 ${ref.node} 不存在`).toBeTruthy()
    }
  })

  it('每一卦的十翼层（彖/象/系辞/序卦/杂卦…）都指向同一批课程节点', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.tenWings.tuan.node).toBe(TEN_WINGS_REF.tuan.node)
      expect(p.tenWings.daxiang.node).toBe(TEN_WINGS_REF.xiang.node)
      expect(p.tenWings.xici.node).toBe(TEN_WINGS_REF.xici.node)
      expect(p.tenWings.xugua.node).toBe(TEN_WINGS_REF.xugua.node)
      expect(p.tenWings.zagua.node).toBe(TEN_WINGS_REF.zagua.node)
    }
  })

  it('大象文本来自单一数据源（hexagrams-data.imagery），无二次手写', () => {
    for (const p of HEXAGRAM_PROFILES) {
      // imagery 与 tenWings.daxiang.text 是同一来源引用
      expect(p.tenWings.daxiang.text).toBe(p.imagery)
      expect(p.tenWings.daxiang.text, `${p.name} 缺大象`).toBeTruthy()
    }
  })

  it('解释传统引用的 nodeId 全部可解析；每卦/每爻都挂载同套传统', () => {
    for (const t of TRADITION_REF) {
      expect(getCurriculumNode(t.node), `传统节点 ${t.node} 不存在`).toBeTruthy()
    }
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.interpretationTraditions.map((t) => t.key)).toEqual(TRADITION_REF.map((t) => t.key))
      for (const y of p.yao) {
        expect(y.interpretationTraditions.map((t) => t.key)).toEqual(TRADITION_REF.map((t) => t.key))
      }
    }
  })

  it('文言只对乾坤两卦挂载（其余为 null，不强行套用）', () => {
    expect(getHexagramProfile('乾').tenWings.wenyan).toBeTruthy()
    expect(getHexagramProfile('坤').tenWings.wenyan).toBeTruthy()
    expect(getHexagramProfile('屯').tenWings.wenyan).toBeNull()
    expect(getHexagramProfile('未济').tenWings.wenyan).toBeNull()
  })
})

describe('64卦深度档案 · 案例/误读可反向关联', () => {
  it('每卦的常见误读（myth）都有可靠来源且挂到各爻', () => {
    for (const p of HEXAGRAM_PROFILES) {
      expect(p.myth, `${p.name} 缺常见误读`).toBeTruthy()
      for (const y of p.yao) {
        expect(y.commonMistakes).toContain(p.myth)
      }
    }
  })

  it('各爻预留 cases / practiceIds 字段，可为后续接线（当前可空）', () => {
    for (const y of ALL_YAO) {
      expect(Array.isArray(y.cases)).toBe(true)
      expect(Array.isArray(y.practiceIds)).toBe(true)
    }
  })
})