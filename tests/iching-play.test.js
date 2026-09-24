// ============================================================
// 🎮 易经工坊引擎测试（Phase 4 · Step 7）
//   1. 闪卡出题：四种模式，选项含正确项、不重复、可解释
//   2. 卦象侦探：错/综/互的答案与工具计算一致、可解释
//   3. 古文破译：数据完整、评价确定性、绝对化表达扣分
// 运行：npm test
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  shuffle,
  pickDistinct,
  flashcardRound,
  FLASH_MODES,
  detectiveRound,
  DETECTIVE_KINDS,
  decoderRound,
  TEXT_DECODER_SET,
  evaluateDecoder,
} from '../src/data/iching/playEngine'
import {
  getHexagram,
  hexagramRelations,
  oppositeHex,
  reverseHex,
  mutualHex,
} from '../src/data/iching/hexagramTools'
import { HEXAGRAMS } from '../src/data/iching/hexagrams-data'

// 固定随机源：0.1 递增（确定性，每次新建避免状态污染）
function freshRng() {
  let i = 0
  return () => (i++ % 10) / 10
}

describe('闪卡出题', () => {
  it('四种模式都有配置说明', () => {
    expect(FLASH_MODES.map((m) => m.value)).toEqual(['symbol-name', 'name-symbol', 'name-nature', 'upper-lower-name'])
    for (const m of FLASH_MODES) expect(m.label).toBeTruthy()
  })

  it('symbol-name：卦符→卦名，4 个选项含正确项且不重复', () => {
    for (let i = 0; i < 30; i++) {
      const q = flashcardRound('symbol-name')
      expect(q.prompt.length).toBeGreaterThan(0)
      expect(q.options.length).toBe(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
      expect(q.explain).toContain(q.answer)
      expect(q.nodeId).toBe('bg-xiantian')
    }
  })

  it('name-symbol：卦名→卦符，答案在选项中', () => {
    const q = flashcardRound('name-symbol')
    expect(['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷']).toContain(q.answer)
    expect(q.options).toContain(q.answer)
    expect(q.options.length).toBe(4)
  })

  it('name-nature：卦名→自然象，答案匹配八卦数据', () => {
    const q = flashcardRound('name-nature')
    expect(['天', '泽', '火', '雷', '风', '水', '山', '地']).toContain(q.answer)
    expect(q.options).toContain(q.answer)
  })

  it('upper-lower-name：上下卦→六十四卦名，答案与数据一致', () => {
    for (let i = 0; i < 30; i++) {
      const q = flashcardRound('upper-lower-name')
      expect(q.prompt).toMatch(/^上.+ 下.+$/)
      expect(q.options.length).toBe(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
      // 答案必须是一个真实六十四卦全名（乾为天 / 火水未济 等）
      expect(HEXAGRAMS.some((h) => h.full === q.answer)).toBe(true)
      expect(q.nodeId).toBe('hg-read-card')
    }
  })

  it('shuffle / pickDistinct：确定性且不改变内容', () => {
    const arr = [1, 2, 3, 4, 5]
    const s1 = shuffle(arr, freshRng())
    const s2 = shuffle(arr, freshRng())
    expect([...s1].sort()).toEqual([...arr].sort())
    const picked = pickDistinct([1, 2, 3, 4, 5], 3, freshRng())
    expect(picked.length).toBe(3)
    expect(new Set(picked).size).toBe(3)
    expect(s1).toEqual(s2) // 同一随机源 → 同一结果
  })
})

describe('卦象侦探', () => {
  it('三种任务类型都正确出题', () => {
    for (const k of DETECTIVE_KINDS) {
      const q = detectiveRound(k.value)
      expect(q).toBeTruthy()
      expect(q.kind).toBe(k.value)
      expect(q.options.length).toBe(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
      expect(q.why).toContain('→')
      expect(q.nodeId).toBe('hc-detective')
    }
  })

  it('错卦答案与工具计算一致（随机多轮）', () => {
    for (let i = 0; i < 30; i++) {
      const q = detectiveRound('opposite')
      const target = getHexagram(q.target.lines)
      const expectAns = getHexagram(oppositeHex(q.target.lines))
      expect(q.answer).toBe(expectAns.name)
      expect(q.target.full).toBe(target.full)
    }
  })

  it('综卦答案与工具计算一致', () => {
    for (let i = 0; i < 30; i++) {
      const q = detectiveRound('reverse')
      const expectAns = getHexagram(reverseHex(q.target.lines))
      expect(q.answer).toBe(expectAns.name)
    }
  })

  it('互卦答案与工具计算一致', () => {
    for (let i = 0; i < 30; i++) {
      const q = detectiveRound('mutual')
      const expectAns = getHexagram(mutualHex(q.target.lines))
      expect(q.answer).toBe(expectAns.name)
    }
  })

  it('题目与答案不会重复（干扰项不含目标卦）', () => {
    for (let i = 0; i < 30; i++) {
      const q = detectiveRound('opposite')
      expect(q.options).not.toContain(q.target.name)
    }
  })
})

describe('古文破译室', () => {
  it('破译题库覆盖 10+ 卦且字段完整', () => {
    expect(TEXT_DECODER_SET.length).toBeGreaterThanOrEqual(10)
    for (const d of TEXT_DECODER_SET) {
      expect(d.name).toBeTruthy()
      expect(d.guaci.length).toBeGreaterThan(0)
      expect(d.tokens.length).toBeGreaterThanOrEqual(3)
      expect(d.keyTokens.length).toBeGreaterThanOrEqual(1)
      expect(d.meaning.length).toBeGreaterThan(10)
      expect(d.wrongMeanings.length).toBeGreaterThanOrEqual(2)
      expect(d.multiNote.length).toBeGreaterThan(10)
      expect(d.nodeId).toBe('ht-guaci')
      // keyTokens 必须来自 tokens
      for (const kt of d.keyTokens) expect(d.tokens.some((t) => kt.includes(t)) || d.tokens.includes(kt)).toBe(true)
    }
  })

  it('decoderRound 返回题库内一条', () => {
    const d = decoderRound()
    expect(TEXT_DECODER_SET.map((x) => x.id)).toContain(d.id)
  })

  it('评价：命中全部关键词 + 正确解释 → 高分', () => {
    const item = TEXT_DECODER_SET[0] // 乾
    const ev = evaluateDecoder(item, item.keyTokens, item.meaning)
    expect(ev.keyScore).toBe(100)
    expect(ev.meaningScore).toBe(100)
    expect(ev.quality).toBeGreaterThanOrEqual(90)
    expect(ev.overWords).toEqual([])
  })

  it('评价：未选关键词 + 错误解释 → 低分', () => {
    const item = TEXT_DECODER_SET[0]
    const ev = evaluateDecoder(item, [], item.wrongMeanings[0])
    expect(ev.keyScore).toBe(0)
    expect(ev.meaningScore).toBe(25)
    expect(ev.quality).toBeLessThan(50)
  })

  it('评价：绝对化表达被检测并扣分', () => {
    const item = TEXT_DECODER_SET[0]
    const clean = evaluateDecoder(item, item.keyTokens, item.meaning)
    const abs = evaluateDecoder(item, item.keyTokens, item.meaning, '这个卦一定代表成功，注定顺利')
    expect(abs.overWords.length).toBeGreaterThan(0)
    expect(abs.quality).toBeLessThan(clean.quality)
  })

  it('评价：确定性——同一输入产生同一结果', () => {
    const item = TEXT_DECODER_SET[1] // 坤
    const a = evaluateDecoder(item, ['牝马'], item.meaning, '跟随但不盲从')
    const b = evaluateDecoder(item, ['牝马'], item.meaning, '跟随但不盲从')
    expect(a).toEqual(b)
  })

  it('错误白话选项都不是「目前无法判断」式逃避，而是真正错误的理解', () => {
    for (const d of TEXT_DECODER_SET) {
      for (const w of d.wrongMeanings) {
        expect(w).not.toBe(d.meaning)
        expect(w.length).toBeGreaterThan(5)
      }
    }
  })
})
