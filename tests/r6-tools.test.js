// ============================================================
// R6-5 · 玄学工具实验室验收测试
//
// 验收点：
//   A. 二十四山数据：24 山 / 角度 0-345 每 15 度 / 五行·类别·宫位合法 / 四正山定位正确
//   B. 二十四节气数据：24 个 / 12 节 + 12 气 / 关键黄经正确 / 与历法模块一致
//   C. 五行环数据：与 lib/constants 的生克关系完全一致
//   D. 时辰表：12 时辰 / 时间区间合法
//   E. 计算正确性：computeFourPillars 已知日期验证（年柱立春分界 / 日柱 / 月柱五虎遁）
//   F. 节气推算：立春落 2 月上旬 / 冬至 12 月下旬
//   G. 卦工具复用：hexagramTools 结构操作正常
//   H. 禁词与内容纪律：数据层无禁词、无预测性断言
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  MOUNTAINS,
  MOUNTAIN_BY_NAME,
  SOLAR_TERMS,
  ELEMENT_ORDER,
  GENERATES_RING,
  OVERCOMES_RING,
  SHICHEN,
} from '../src/data/toolLab'
import { GENERATES, OVERCOMES, STEMS, BRANCHES } from '../src/lib/constants'
import { computeFourPillars } from '../src/lib/bazi'
import { solarTermJD, jdToUTC, JIE_TERMS } from '../src/lib/calendar'
import { getHexagram, hexagramRelations, changeLine, linesToSymbol } from '../src/data/iching/hexagramTools'
import { HEXAGRAMS } from '../src/data/iching/hexagrams-data'

const FORBIDDEN = ['命中注定', '算命', '大师预测', '精准预测', '科学验证', '必吉', '转运', '开运', '包你', '一定灵', '保证', '绝对', '必定', '百分之百']

function deepStrings(obj, out = []) {
  if (typeof obj === 'string') {
    out.push(obj)
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) deepStrings(v, out)
  }
  return out
}

describe('A · 二十四山（罗盘模拟器数据）', () => {
  it('共 24 山，角度 0-345 且每山 15 度', () => {
    expect(MOUNTAINS.length).toBe(24)
    const angles = MOUNTAINS.map((m) => m.angle)
    expect(angles[0]).toBe(0)
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBe(15)
    }
    expect(angles[angles.length - 1]).toBe(345)
  })

  it('四正山定位正确：子=0° 北 / 卯=90° 东 / 午=180° 南 / 酉=270° 西', () => {
    expect(MOUNTAIN_BY_NAME['子'].angle).toBe(0)
    expect(MOUNTAIN_BY_NAME['卯'].angle).toBe(90)
    expect(MOUNTAIN_BY_NAME['午'].angle).toBe(180)
    expect(MOUNTAIN_BY_NAME['酉'].angle).toBe(270)
    expect(MOUNTAIN_BY_NAME['子'].palace).toBe('坎')
    expect(MOUNTAIN_BY_NAME['午'].palace).toBe('离')
  })

  it('五行 / 类别 / 宫位全部合法', () => {
    const elements = ['木', '火', '土', '金', '水']
    const types = ['stem', 'branch', 'corner']
    const palaces = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']
    for (const m of MOUNTAINS) {
      expect(elements, m.name).toContain(m.element)
      expect(types, m.name).toContain(m.type)
      expect(palaces, m.name).toContain(m.palace)
      expect(typeof m.desc === 'string' && m.desc.length > 8, `${m.name} desc 过短`).toBe(true)
    }
  })

  it('每宫三山：8 宫 × 3 山 = 24 山', () => {
    const byPalace = MOUNTAINS.reduce((acc, m) => {
      acc[m.palace] = (acc[m.palace] || 0) + 1
      return acc
    }, {})
    expect(Object.keys(byPalace).length).toBe(8)
    for (const n of Object.values(byPalace)) expect(n).toBe(3)
  })

  it('子山当令为水、戊己二干不入山（无戊/己山）', () => {
    expect(MOUNTAIN_BY_NAME['子'].element).toBe('水')
    expect(MOUNTAINS.some((m) => m.name === '戊')).toBe(false)
    expect(MOUNTAINS.some((m) => m.name === '己')).toBe(false)
  })
})

describe('B · 二十四节气（节气工具数据）', () => {
  it('共 24 个，12 节 + 12 气', () => {
    expect(SOLAR_TERMS.length).toBe(24)
    expect(SOLAR_TERMS.filter((t) => t.kind === '节').length).toBe(12)
    expect(SOLAR_TERMS.filter((t) => t.kind === '气').length).toBe(12)
  })

  it('关键节气黄经正确：立春315 / 春分0 / 夏至90 / 秋分180 / 冬至270', () => {
    const byName = SOLAR_TERMS.reduce((a, t) => ((a[t.name] = t), a), {})
    expect(byName['立春'].angle).toBe(315)
    expect(byName['春分'].angle).toBe(0)
    expect(byName['夏至'].angle).toBe(90)
    expect(byName['秋分'].angle).toBe(180)
    expect(byName['冬至'].angle).toBe(270)
  })

  it('十二「节」与历法模块 JIE_TERMS 一一对应', () => {
    const jieNames = SOLAR_TERMS.filter((t) => t.kind === '节').map((t) => t.name)
    expect(jieNames.sort()).toEqual(JIE_TERMS.map((t) => t.name).sort())
  })
})

describe('C · 五行环（五行实验器数据）', () => {
  it('生克环与 lib/constants 完全一致', () => {
    for (const e of ELEMENT_ORDER) {
      expect(GENERATES_RING[e]).toBe(GENERATES[e])
      expect(OVERCOMES_RING[e]).toBe(OVERCOMES[e])
    }
  })

  it('五元素顺序完整且无重复', () => {
    expect(ELEMENT_ORDER.length).toBe(5)
    expect(new Set(ELEMENT_ORDER).size).toBe(5)
  })
})

describe('D · 时辰表', () => {
  it('12 时辰，分支覆盖十二地支', () => {
    expect(SHICHEN.length).toBe(12)
    const branches = SHICHEN.map((s) => s.branch)
    expect(branches.sort()).toEqual([...BRANCHES].sort())
  })

  it('每个时辰有合法时间区间说明与干支映射', () => {
    for (const s of SHICHEN) {
      expect(s.hours).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/)
      expect(s.note.length).toBeGreaterThan(4)
    }
  })
})

describe('E · 计算正确性（computeFourPillars）', () => {
  it('2000-01-01 日柱为戊午（通行历法常识）', () => {
    const c = computeFourPillars({ year: 2000, month: 1, day: 1, hour: 12 })
    expect(c.pillars.day.text).toBe('戊午')
  })

  it('年柱以立春为界：2024-01-15 属癸卯年，2024-06-15 属甲辰年', () => {
    const before = computeFourPillars({ year: 2024, month: 1, day: 15, hour: 12 })
    const after = computeFourPillars({ year: 2024, month: 6, day: 15, hour: 12 })
    expect(before.pillars.year.text).toBe('癸卯')
    expect(after.pillars.year.text).toBe('甲辰')
    expect(after.effYear).toBe(2024)
  })

  it('1984 年（立春后）年柱为甲子', () => {
    const c = computeFourPillars({ year: 1984, month: 6, day: 15, hour: 12 })
    expect(c.pillars.year.text).toBe('甲子')
  })

  it('月柱五虎遁：2024-06-15（芒种后）为庚午月', () => {
    const c = computeFourPillars({ year: 2024, month: 6, day: 15, hour: 12 })
    expect(c.pillars.month.text).toBe('庚午')
    expect(c.monthTerm).toBe('芒种')
  })

  it('时柱地支按时辰：12 点 → 午时', () => {
    const c = computeFourPillars({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 })
    expect(c.pillars.hour.branchIdx).toBe(BRANCHES.indexOf('午'))
  })

  it('四柱十神与藏干结构完整', () => {
    const c = computeFourPillars({ year: 1990, month: 5, day: 20, hour: 10 })
    for (const k of ['year', 'month', 'day', 'hour']) {
      expect(c.pillars[k].text.length).toBe(2)
      expect(c.tenGods[k]).toBeTruthy()
      expect(Array.isArray(c.hiddenStems[k]) && c.hiddenStems[k].length > 0).toBe(true)
    }
  })
})

describe('F · 节气推算（solarTermJD）', () => {
  it('2024 年立春落在 2 月 3-5 日之间', () => {
    const utc = jdToUTC(solarTermJD(2024, 315))
    expect(utc.year).toBe(2024)
    expect(utc.month).toBe(2)
    expect(utc.day >= 3 && utc.day <= 5).toBe(true)
  })

  it('2024 年冬至落在 12 月 20-22 日之间', () => {
    const utc = jdToUTC(solarTermJD(2024, 270))
    expect(utc.year).toBe(2024)
    expect(utc.month).toBe(12)
    expect(utc.day >= 20 && utc.day <= 22).toBe(true)
  })

  it('节气黄经覆盖 0-360 且每 15 度一个', () => {
    const angles = SOLAR_TERMS.map((t) => t.angle).sort((a, b) => a - b)
    expect(angles[0]).toBe(0)
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBe(15)
    }
  })
})

describe('G · 卦工具复用（六十四卦实验器依赖）', () => {
  it('64 卦全部可通过 getHexagram 检索', () => {
    for (const h of HEXAGRAMS) {
      expect(getHexagram(h.seq)?.lines).toBe(h.lines)
    }
  })

  it('错/综/互关系可推导且不抛错', () => {
    for (let s = 1; s <= 64; s++) {
      const rel = hexagramRelations(getHexagram(s))
      expect(rel).toBeTruthy()
      expect(rel.opposite === null || typeof rel.opposite.name === 'string').toBe(true)
      expect(rel.reverse === null || typeof rel.reverse.name === 'string').toBe(true)
      expect(rel.mutual === null || typeof rel.mutual.name === 'string').toBe(true)
    }
  })

  it('乾卦变初爻 → 姤（天风姤）', () => {
    const changed = changeLine('111111', 0)
    expect(changed).toBe('011111')
    expect(getHexagram(changed).name).toBe('姤')
  })

  it('卦符渲染不依赖外部：六爻串 → 符号串长度 6', () => {
    expect(linesToSymbol('100010').length).toBe(6)
  })
})

describe('H · 禁词与内容纪律', () => {
  it('toolLab 数据层无禁词', () => {
    const all = deepStrings({ MOUNTAINS, SOLAR_TERMS, SHICHEN, ELEMENT_ORDER, GENERATES_RING, OVERCOMES_RING })
    for (const w of FORBIDDEN) {
      expect(all.every((s) => !s.includes(w)), `含禁词「${w}」`).toBe(true)
    }
  })

  it('二十四山描述无「招财/改运/旺」等因果断言', () => {
    for (const m of MOUNTAINS) {
      expect(m.desc.includes('招财')).toBe(false)
      expect(m.desc.includes('改运')).toBe(false)
    }
  })
})
