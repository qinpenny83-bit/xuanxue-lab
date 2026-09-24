// ============================================================
// 🧰 玄学工具实验室（R6-5）· 六个确定性工具
//
//   1. 干支历    —— 公历 → 年/月/日/时四柱干支 + 节气定位
//   2. 五行实验器 —— 生克关系环 + 季节旺相休囚死
//   3. 六十四卦实验器 —— 卦象 / 错综互 / 任意爻变卦
//   4. 罗盘模拟器 —— 二十四山方位盘
//   5. 节气工具  —— 全年二十四节气时刻表
//   6. 排盘学习工具 —— 出生信息 → 四柱 + 十神 + 藏干 + 五行
//
// 全部为确定性本地计算：结果可复现、可解释、可核对。
// 定位是「传统文化学习与观察」，不把结果包装成预测或判决。
// ============================================================
import React, { useState, useMemo } from 'react'
import { PageHead, Remind, Pill } from '../components/ui'
import { computeFourPillars } from '../lib/bazi'
import { STEMS, BRANCHES, WANG_SHUAI, ELEMENT_COLORS } from '../lib/constants'
import { solarTermJD, jdToUTC, utcToJD } from '../lib/calendar'
import {
  getHexagram,
  hexagramRelations,
  changeLine,
  linesToSymbol,
  lineLabel,
  LINE_POSITIONS,
} from '../data/iching/hexagramTools'
import { HEXAGRAMS } from '../data/iching/hexagrams-data'
import {
  MOUNTAINS,
  MOUNTAIN_BY_NAME,
  MOUNTAIN_TYPE_LABEL,
  SOLAR_TERMS,
  ELEMENT_ORDER,
  GENERATES_RING,
  OVERCOMES_RING,
  ELEMENT_IMAGERY,
  SHICHEN,
} from '../data/toolLab'

// ── 工具注册表 ──────────────────────────────────────────
const TOOLS = [
  { id: 'ganzhi', label: '干支历', emoji: '📅' },
  { id: 'element', label: '五行实验器', emoji: '♻️' },
  { id: 'hexagram', label: '六十四卦实验器', emoji: '☯️' },
  { id: 'compass', label: '罗盘模拟器', emoji: '🧭' },
  { id: 'solar', label: '节气工具', emoji: '🌾' },
  { id: 'paipan', label: '排盘学习', emoji: '📇' },
]

const HOUR_OF_SHICHEN = { 子: 23, 丑: 1, 寅: 3, 卯: 5, 辰: 7, 巳: 9, 午: 11, 未: 13, 申: 15, 酉: 17, 戌: 19, 亥: 21 }

// ============================================================
// 工具 1 · 干支历
// ============================================================
function todayInput() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() }
}

function GanzhiCal() {
  const t = todayInput()
  const [y, setY] = useState(t.y)
  const [m, setM] = useState(t.m)
  const [day, setDay] = useState(t.day)
  const [shichen, setShichen] = useState('子')
  const [run, setRun] = useState(false)

  const chart = useMemo(() => {
    if (!run) return null
    try {
      return computeFourPillars({ year: y, month: m, day, hour: HOUR_OF_SHICHEN[shichen] ?? 0, minute: 0 })
    } catch {
      return null
    }
  }, [run, y, m, day, shichen])

  const cols = [
    ['年柱', chart?.pillars.year?.text, '以立春为界'],
    ['月柱', chart?.pillars.month?.text, '以「节」为界'],
    ['日柱', chart?.pillars.day?.text, '公历自然日'],
    ['时柱', chart?.pillars.hour?.text, '23 点子时起'],
  ]

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>📅 公历 → 干支历</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>输入公历日期与时辰，换算四柱干支与节气定位。年柱以立春为界、月柱以十二「节」为界，这是传统干支历的通用规则。</p>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        {[
          ['年', y, setY], ['月', m, setM], ['日', day, setDay],
        ].map(([label, val, set]) => (
          <div className="field" key={label}>
            <label>{label}</label>
            <input type="number" value={val} onChange={(e) => set(Number(e.target.value) || 0)} />
          </div>
        ))}
        <div className="field">
          <label>时辰</label>
          <select value={shichen} onChange={(e) => setShichen(e.target.value)}>
            {SHICHEN.map((s) => <option key={s.name} value={s.branch}>{s.name}（{s.hours}）</option>)}
          </select>
        </div>
      </div>
      <button className="btn" onClick={() => setRun(true)}>换算四柱</button>

      {chart && (
        <div style={{ marginTop: 18 }}>
          <div className="grid-2">
            {cols.map(([label, text, note]) => (
              <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{label} · {note}</div>
                <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{text || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Pill tone="amber">所属「节」：{chart.monthTerm}</Pill>
            <Pill tone="teal">日柱甲子序：{chart.pillars.day.text}</Pill>
            {chart.nearBoundary && <Pill tone="red">出生时刻临近节气交接（±1 小时），月柱需精确到分钟核对</Pill>}
          </div>
          <div className="remind" style={{ marginTop: 14 }}>
            <span className="r-ico">💡</span>
            <div style={{ fontSize: 13 }}>干支历是时间记号体系，不是因果结论。换算出「今天是什么干支」用于观察与学习，不用于断言吉凶。</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 工具 2 · 五行实验器
// ============================================================
const SEASONS = ['春', '夏', '四季', '秋', '冬']

function ElementLab() {
  const [me, setMe] = useState('木')
  const [season, setSeason] = useState('春')
  const gen = GENERATES_RING[me]
  const gives = ELEMENT_ORDER.filter((e) => GENERATES_RING[e] === me)
  const over = OVERCOMES_RING[me]
  const overBy = ELEMENT_ORDER.filter((e) => OVERCOMES_RING[e] === me)
  const wang = WANG_SHUAI[season]

  const ring = [
    { label: '我生', el: gen, icon: '→' },
    { label: '生我', el: gives[0], icon: '←' },
    { label: '我克', el: over, icon: '⤳' },
    { label: '克我', el: overBy[0], icon: '⤴' },
  ]

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>♻️ 五行生克实验器</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>选一行，看它的生克关系；选一个季节，看旺相休囚死。五行生克是「关系框架」，不是自然规律断言。</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {ELEMENT_ORDER.map((e) => (
          <button
            key={e}
            className={`tool-tab ${me === e ? 'active' : ''}`}
            style={me === e ? { background: ELEMENT_COLORS[e], borderColor: ELEMENT_COLORS[e], color: '#fff' } : {}}
            onClick={() => setMe(e)}
          >
            {ELEMENT_IMAGERY[e].symbol} {e}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>{me} 的生克关系</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ring.map((r) => (
              <div key={r.label} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.icon} {r.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{r.el}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>季节旺衰（{season}）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(wang).map(([k, v]) => (
              <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', opacity: v === me ? 1 : 0.72, background: v === me ? 'rgba(217,164,65,0.1)' : 'transparent' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {SEASONS.map((s) => (
              <button key={s} className={`tool-tab ${season === s ? 'active' : ''}`} style={season === s ? { fontSize: 13, padding: '6px 12px' } : { fontSize: 13, padding: '6px 12px' }} onClick={() => setSeason(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone="teal">{me}在{season}为「{Object.entries(wang).find(([, v]) => v === me)?.[0]}」</Pill>
        <Pill tone="gray">{ELEMENT_IMAGERY[me].symbol} {ELEMENT_IMAGERY[me].desc}</Pill>
      </div>
      <div className="remind" style={{ marginTop: 12 }}>
        <span className="r-ico">⚠️</span>
        <div style={{ fontSize: 13 }}>「木克土」是关系描述，不等于「属木的人克属土的人」——把五行关系直接套到具体的人与事上，是常见的过度解释。</div>
      </div>
    </div>
  )
}

// ============================================================
// 工具 3 · 六十四卦实验器
// ============================================================
function HexagramLab() {
  const [seq, setSeq] = useState(1)
  const [flip, setFlip] = useState(null)
  const h = getHexagram(seq)
  const rel = hexagramRelations(h)

  const selectHex = (s) => {
    setSeq(Number(s))
    setFlip(null)
  }

  const currentLines = flip != null && h ? changeLine(h.lines, flip) : (h?.lines || '')
  const currentHex = getHexagram(currentLines)
  const isChanged = flip != null

  const lines = h ? h.lines.split('').map((c, i) => ({ yang: c === '1', i })) : []

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>☯️ 六十四卦实验器</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>任选一卦，看卦象与结构关系；点击任意爻翻转，观察变卦。错、综、互、变都是「结构操作」，不是隐藏答案。</p>
      <div className="field" style={{ marginBottom: 14, maxWidth: 340 }}>
        <label>选择一卦</label>
        <select value={seq} onChange={(e) => selectHex(e.target.value)}>
          {HEXAGRAMS.map((x) => (
            <option key={x.seq} value={x.seq}>{x.seq} {x.full}（{x.name}）</option>
          ))}
        </select>
      </div>

      {h && (
        <>
          <div className="grid-2">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                {isChanged ? `变卦：${currentHex?.full || '—'}` : `${h.full}`} · {isChanged ? `第 ${flip + 1} 爻动` : '本卦'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lines.map((l) => (
                  <button
                    key={l.i}
                    className="tool-tab"
                    style={{ fontSize: 22, padding: '6px 12px', background: flip === l.i ? 'rgba(217,164,65,0.18)' : undefined, borderColor: flip === l.i ? 'var(--amber)' : undefined }}
                    onClick={() => setFlip(flip === l.i ? null : l.i)}
                    title={`${lineLabel(l.i, l.yang)}（点击变爻）`}
                  >
                    {l.yang ? '⚊' : '⚋'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                {lines.map((l) => lineLabel(l.i, l.yang)).join(' · ')}
              </div>
              <div className="display" style={{ fontSize: 15, marginTop: 10 }}>{h.guaci}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>{h.plain}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>结构关系</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['错卦（旁通）', rel.opposite, '六爻全变'],
                  ['综卦（覆卦）', rel.reverse, '上下颠倒'],
                  ['互卦', rel.mutual, '二三四＋三四五'],
                  ['上卦/下卦', { name: `${h.upper}/${h.lower}` }, `${h.upper} 上 · ${h.lower} 下`],
                ].map(([label, obj, note]) => (
                  <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{label} · {note}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>
                      {obj ? (obj.name || obj.full) : '—'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 12 }}>💡 意象：{h.imagery}</div>
            </div>
          </div>
          <div className="remind" style={{ marginTop: 14 }}>
            <span className="r-ico">🧭</span>
            <div style={{ fontSize: 13 }}>{h.myth}</div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// 工具 4 · 罗盘模拟器
// ============================================================
function CompassSim() {
  const [sel, setSel] = useState('子')
  const m = MOUNTAIN_BY_NAME[sel]
  const R = 148
  const C = 180
  const pals = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  const samePalace = MOUNTAINS.filter((x) => x.palace === m.palace)
  const palaceName = { 坎: '北', 艮: '东北', 震: '东', 巽: '东南', 离: '南', 坤: '西南', 兑: '西', 乾: '西北' }[m.palace]

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>🧭 罗盘模拟器 · 二十四山</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>正北为子山（0°），顺时针每山 15 度。点任意山查看它的五行、类别与宫位。此盘用于认识方位坐标，不是「摆件改运」的开关。</p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 360, height: 360, flexShrink: 0 }}>
          <svg width={360} height={360} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth={2} />
            <circle cx={C} cy={C} r={R - 24} fill="none" stroke="rgba(28,26,23,0.05)" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
              const rad = ((a - 90) * Math.PI) / 180
              return (
                <line key={a} x1={C + (R - 34) * Math.cos(rad)} y1={C + (R - 34) * Math.sin(rad)} x2={C + (R - 12) * Math.cos(rad)} y2={C + (R - 12) * Math.sin(rad)} stroke="rgba(28,26,23,0.25)" strokeWidth={1.5} />
              )
            })}
            <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgba(28,26,23,0.08)" />
            <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgba(28,26,23,0.08)" />
          </svg>
          {MOUNTAINS.map((mt) => {
            const rad = ((mt.angle - 90) * Math.PI) / 180
            const x = C + R * Math.cos(rad) - 22
            const y = C + R * Math.sin(rad) - 16
            const active = sel === mt.name
            return (
              <button
                key={mt.name}
                onClick={() => setSel(mt.name)}
                style={{
                  position: 'absolute', left: x, top: y, width: 44, height: 32,
                  border: active ? '2px solid var(--amber)' : '1px solid var(--line)',
                  borderRadius: 8, background: active ? ELEMENT_COLORS[mt.element] : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {mt.name}
              </button>
            )
          })}
          <div style={{ position: 'absolute', left: C - 45, top: C - 45, width: 90, height: 90, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>选中</div>
              <div className="display" style={{ fontSize: 26, fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{m.angle}°</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: ELEMENT_COLORS[m.element], color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{m.name}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{m.name}山 · {m.angle}°</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{palaceName} · {MOUNTAIN_TYPE_LABEL[m.type]} · 五行属{m.element}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{m.desc}</p>
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)' }}>同宫三山：</span>
              {samePalace.map((x) => (
                <button key={x.name} className="tool-tab" style={{ fontSize: 12, padding: '4px 10px', marginRight: 6, marginBottom: 6, background: sel === x.name ? 'var(--ink)' : undefined, color: sel === x.name ? '#fff' : undefined }} onClick={() => setSel(x.name)}>{x.name}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              四正：{['子', '午', '卯', '酉'].join(' ')} · 四维：{['乾', '坤', '艮', '巽'].join(' ')} · 天干十位（戊己居中不入盘）
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {pals.map((p) => (
              <button key={p} className="tool-tab" style={{ fontSize: 12, padding: '4px 10px', background: sel === p ? 'var(--ink)' : undefined, color: sel === p ? '#fff' : undefined }} onClick={() => setSel(p)}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 工具 5 · 节气工具
// ============================================================
const MONTH_PAIRS = [
  ['立春', '雨水'], ['惊蛰', '春分'], ['清明', '谷雨'], ['立夏', '小满'],
  ['芒种', '夏至'], ['小暑', '大暑'], ['立秋', '处暑'], ['白露', '秋分'],
  ['寒露', '霜降'], ['立冬', '小雪'], ['大雪', '冬至'], ['小寒', '大寒'],
]

function fmtUTC(utc) {
  const p = (n) => String(n).padStart(2, '0')
  return `${utc.year}-${p(utc.month)}-${p(utc.day)} ${p(utc.hour)}:${p(utc.minute)}`
}

function SolarTermTool() {
  const t = todayInput()
  const [y, setY] = useState(t.y)
  const rows = useMemo(() => {
    return SOLAR_TERMS.map((st) => {
      const jd = solarTermJD(y, st.angle)
      return { ...st, utc: jdToUTC(jd) }
    })
  }, [y])

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>🌾 二十四节气工具</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>按太阳黄经推算全年节气时刻（低精度天文算法，误差约数分钟）。「节」是干支历月柱的分界，两个节气一组构成一个月。</p>
      <div className="field" style={{ maxWidth: 200, marginBottom: 14 }}>
        <label>年份</label>
        <input type="number" value={y} onChange={(e) => setY(Number(e.target.value) || new Date().getFullYear())} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.name} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: r.kind === '节' ? 'rgba(50,143,126,0.06)' : 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</span>
              <Pill tone={r.kind === '节' ? 'teal' : 'gray'}>{r.kind}</Pill>
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{fmtUTC(r.utc)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>黄经 {r.angle}°</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-2)' }}>
        月份分组（节 + 气）：{MONTH_PAIRS.map((p) => p.join('·')).join(' ｜ ')}
      </div>
    </div>
  )
}

// ============================================================
// 工具 6 · 排盘学习工具
// ============================================================
function PaiPanTool() {
  const t = todayInput()
  const [y, setY] = useState(t.y)
  const [m, setM] = useState(t.m)
  const [day, setDay] = useState(t.day)
  const [hour, setHour] = useState(12)
  const [minute, setMinute] = useState(0)
  const [run, setRun] = useState(false)

  const chart = useMemo(() => {
    if (!run) return null
    try {
      return computeFourPillars({ year: y, month: m, day, hour, minute, utcOffsetHours: 8 })
    } catch {
      return null
    }
  }, [run, y, m, day, hour, minute])

  const pillarKeys = ['year', 'month', 'day', 'hour']
  const pillarNames = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' }
  const maxCount = chart ? Math.max(1, ...Object.values(chart.counts)) : 1

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>📇 排盘学习工具</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>输入出生信息，按传统规则排出四柱，并标注十神、藏干与五行统计。默认按东八区（北京时间）计算。</p>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="field"><label>年</label><input type="number" value={y} onChange={(e) => setY(Number(e.target.value) || 0)} /></div>
        <div className="field"><label>月</label><input type="number" value={m} onChange={(e) => setM(Number(e.target.value) || 0)} /></div>
        <div className="field"><label>日</label><input type="number" value={day} onChange={(e) => setDay(Number(e.target.value) || 0)} /></div>
        <div className="field"><label>时（24 小时制）</label><input type="number" value={hour} min={0} max={23} onChange={(e) => setHour(Number(e.target.value) || 0)} /></div>
      </div>
      <button className="btn" onClick={() => setRun(true)}>排四柱</button>

      {chart && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {pillarKeys.map((k) => (
              <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{pillarNames[k]}</div>
                <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{chart.pillars[k].text}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>十神：{chart.tenGods[k]}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  藏干：{(chart.hiddenStems[k] || []).map((s) => `${s.stem}(${s.god})`).join(' ')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>五行统计（八个显性干支）</div>
              {ELEMENT_ORDER.map((e) => (
                <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ width: 40, fontSize: 13 }}>{ELEMENT_IMAGERY[e].symbol} {e}</span>
                  <div className="bar" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${(chart.counts[e] / maxCount) * 100}%`, background: ELEMENT_COLORS[e] }} />
                  </div>
                  <span style={{ width: 16, fontSize: 13, textAlign: 'right' }}>{chart.counts[e]}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>旺衰基础参考（月令）</div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, fontSize: 13 }}>
                <div>月令：{chart.wangshuai.seasonBranch}（{chart.wangshuai.season}）</div>
                <div style={{ marginTop: 6 }}>日主五行：{chart.dayElement} → <b>{chart.wangshuai.dayStatus || '—'}</b></div>
                <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 6 }}>{chart.wangshuai.note}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                月柱以「节」为界：{chart.monthTerm} 后换月柱。{chart.nearBoundary ? '出生时刻临近节气边界，需按分钟核对。' : ''}
              </div>
            </div>
          </div>
          <div className="remind" style={{ marginTop: 14 }}>
            <span className="r-ico">🔬</span>
            <div style={{ fontSize: 13 }}>{chart.disclaimer} 本工具用于理解「四柱是怎么排出来的」，不输出任何吉凶断言。</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 页面主体
// ============================================================
export function ToolsPage() {
  const [tab, setTab] = useState('ganzhi')
  return (
    <div>
      <PageHead
        title="🧰 玄学工具实验室"
        sub="六个确定性工具：算干支、看五行、玩卦象、认罗盘、查节气、学排盘——全部本地计算、结果可核对。"
      />
      <div className="tool-tabs" style={{ marginBottom: 16 }}>
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <Remind icon="🧪" >
        <span style={{ fontSize: 13 }}>工具是「观察与学习」的器材，不是「算命的机器」。所有输出都可复现、可对照原典与算法，请带着验证的心态使用。</span>
      </Remind>
      <div style={{ marginTop: 16 }}>
        {tab === 'ganzhi' && <GanzhiCal />}
        {tab === 'element' && <ElementLab />}
        {tab === 'hexagram' && <HexagramLab />}
        {tab === 'compass' && <CompassSim />}
        {tab === 'solar' && <SolarTermTool />}
        {tab === 'paipan' && <PaiPanTool />}
      </div>
    </div>
  )
}
