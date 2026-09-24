// 验证 hexagramTools 关键断言（核对 Phase 4 内容中的卦象示例）
// 编码约定：lines 自下而上（初爻在左），1=阳 0=阴；
//   前三位=下卦，后三位=上卦。例：水雷屯 = 下震(100)+上坎(010) = 100010
import { describe, it, expect } from 'vitest'
import {
  getHexagram,
  oppositeHex,
  reverseHex,
  mutualHex,
  changeLine,
  hexagramRelations,
} from '../src/data/iching/hexagramTools'

describe('hexagramTools 关键断言', () => {
  it('变卦计算正确', () => {
    expect(getHexagram(changeLine('111111', 2)).full).toBe('天泽履') // 乾九三动
    expect(getHexagram(changeLine('000000', 5)).full).toBe('山地剥') // 坤上爻动
    expect(getHexagram(changeLine('000000', 1)).full).toBe('地水师') // 坤二爻动
    expect(getHexagram(changeLine('000000', 4)).full).toBe('水地比') // 坤五爻动
    expect(getHexagram(changeLine('101100', 2)).full).toBe('震为雷') // 丰九三动
    expect(getHexagram(changeLine('100110', 0)).full).toBe('泽地萃') // 随初爻动（初九→初六，下震变坤，下坤上兑）
    expect(getHexagram(changeLine('101010', 0)).full).toBe('水山蹇') // 既济初爻动
  })

  it('错卦计算正确', () => {
    expect(getHexagram(oppositeHex('111111')).full).toBe('坤为地') // 乾错坤
    expect(getHexagram(oppositeHex('010010')).full).toBe('离为火') // 坎错离
    expect(getHexagram(oppositeHex('010101')).full).toBe('水火既济') // 未济错既济
    expect(getHexagram(oppositeHex('101100')).full).toBe('风水涣') // 丰错涣
  })

  it('综卦计算正确', () => {
    expect(getHexagram(reverseHex('100010')).full).toBe('山水蒙') // 屯综蒙
    expect(getHexagram(reverseHex('111000')).full).toBe('天地否') // 泰综否
    expect(getHexagram(reverseHex('101010')).full).toBe('火水未济') // 既济综未济
    expect(getHexagram(reverseHex('101100')).full).toBe('火山旅') // 丰综旅
    expect(reverseHex('111111')).toBe('111111') // 乾自综
    expect(reverseHex('010010')).toBe('010010') // 坎自综
  })

  it('互卦计算正确', () => {
    expect(getHexagram(mutualHex('101010')).full).toBe('火水未济') // 既济互未济
    expect(getHexagram(mutualHex('010101')).full).toBe('水火既济') // 未济互既济
    expect(getHexagram(mutualHex('101100')).full).toBe('泽风大过') // 丰互大过
    expect(getHexagram(mutualHex('001111')).full).toBe('天风姤') // 遁互姤
  })

  it('遁卦关系全链', () => {
    const rel = hexagramRelations(getHexagram('001111'))
    expect(rel.opposite.full).toBe('地泽临')
    expect(rel.reverse.full).toBe('雷天大壮')
    expect(rel.mutual.full).toBe('天风姤')
  })

  it('未济关系全链', () => {
    const rel = hexagramRelations(getHexagram('010101'))
    expect(rel.opposite.full).toBe('水火既济')
    expect(rel.reverse.full).toBe('水火既济')
    expect(rel.mutual.full).toBe('水火既济')
  })
})
