// ============================================================
// 我的命盘：本地八字排盘 + 本地易经起卦（确定性、可解释）。
// ============================================================
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { computeFourPillars, listElementsSorted } from '../lib/bazi'
import { castByTime, castByCoins, castByNumbers, lineSymbol } from '../lib/iching'
import { PageHead, Segmented, Remind, Bar } from '../components/ui'

const TIMEZONES = [
  { label: '北京时间 (UTC+8)', value: 8 },
  { label: '东京 (UTC+9)', value: 9 },
  { label: '伦敦 (UTC+0)', value: 0 },
  { label: '纽约 (UTC-5)', value: -5 },
  { label: '洛杉矶 (UTC-8)', value: -8 },
]

export function ChartPage() {
  const [tab, setTab] = useState('bazi')
  return (
    <div>
      <PageHead title="🔮 我的命盘" sub="一切在本地计算，不上传、不联网。" right={<Segmented items={[{ value: 'bazi', label: '八字排盘' }, { value: 'iching', label: '易经起卦' }]} value={tab} onChange={setTab} />} />
      {tab === 'bazi' ? <BaziPanel /> : <IChingPanel />}
    </div>
  )
}

// ---------------- 八字排盘 ----------------
function BaziPanel() {
  const { state, dispatch } = useApp()
  const [form, setForm] = useState(() => ({
    birthYear: state.userProfile.birthYear,
    birthMonth: state.userProfile.birthMonth,
    birthDay: state.userProfile.birthDay,
    birthHour: state.userProfile.birthHour,
    birthMinute: state.userProfile.birthMinute,
    utcOffsetHours: state.userProfile.utcOffsetHours,
    gender: state.userProfile.gender || '',
  }))

  const chart = useMemo(() => {
    try {
      return computeFourPillars({
        year: form.birthYear,
        month: form.birthMonth,
        day: form.birthDay,
        hour: form.birthHour,
        minute: form.birthMinute,
        utcOffsetHours: form.utcOffsetHours,
      })
    } catch {
      return null
    }
  }, [form])

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  function saveProfile() {
    dispatch({ type: 'SAVE_PROFILE', profile: { ...form } })
  }

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>📅 出生信息</h3>
        <div className="row" style={{ gap: 8 }}>
          <Field label="年"><input type="number" min="1900" max="2100" value={form.birthYear} onChange={(e) => set('birthYear', Number(e.target.value))} /></Field>
          <Field label="月"><input type="number" min="1" max="12" value={form.birthMonth} onChange={(e) => set('birthMonth', Number(e.target.value))} /></Field>
          <Field label="日"><input type="number" min="1" max="31" value={form.birthDay} onChange={(e) => set('birthDay', Number(e.target.value))} /></Field>
        </div>
        <div className="row mt-12" style={{ gap: 8 }}>
          <Field label="时"><input type="number" min="0" max="23" value={form.birthHour} onChange={(e) => set('birthHour', Number(e.target.value))} /></Field>
          <Field label="分"><input type="number" min="0" max="59" value={form.birthMinute} onChange={(e) => set('birthMinute', Number(e.target.value))} /></Field>
          <Field label="性别"><select value={form.gender} onChange={(e) => set('gender', e.target.value)}><option value="">选填</option><option value="male">男</option><option value="female">女</option></select></Field>
        </div>
        <div className="mt-12 field">
          <label>时区（手动选择，无需地图）</label>
          <select value={form.utcOffsetHours} onChange={(e) => set('utcOffsetHours', Number(e.target.value))}>
            {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm mt-12" onClick={saveProfile}>保存为我的信息</button>
      </div>

      {chart ? (
        <div>
          <div className="pillars">
            {[['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱']].map(([k, label]) => (
              <div key={k} className={`pillar ${k === 'day' ? 'day' : ''}`}>
                <div className="p-title">{label}</div>
                <div className="p-stem">{chart.pillars[k].text}</div>
                <div className="p-god">{chart.tenGods[k]}</div>
                <div className="tiny muted mt-8">
                  {chart.hiddenStems[k].map((h) => h.stem).join(' ')}
                </div>
              </div>
            ))}
          </div>

          {chart.nearBoundary && (
            <p className="tiny mt-12" style={{ color: 'var(--amber-deep)' }}>
              ⚠️ 出生时间临近节气边界，若时间不精确，结果可能跨月/跨年，建议核对准确时间。
            </p>
          )}

          <div className="card mt-16">
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>🌳 五行结构</h3>
            {listElementsSorted(chart).map(({ element, count }) => (
              <div key={element} className="five-bar-row">
                <span>{element}</span>
                <Bar value={count} max={4} tone={count >= 3 ? 'teal' : 'amber'} />
                <span>{count}</span>
              </div>
            ))}
            <p className="tiny muted mt-12">
              五行数量只是基础信息，不等于最终判断。旺衰要看「得令、得地、得势」的综合结构。
            </p>
          </div>

          <div className="card mt-16">
            <h3 style={{ fontSize: 16 }}>⚖️ 旺衰基础参考</h3>
            <p className="mt-8">
              出生月令 <b>{chart.monthTerm}</b>（{chart.wangshuai.seasonBranch}月，属{chart.wangshuai.season}季）。
              日主 <b>{chart.dayStem}</b> 五行属 <b>{chart.dayElement}</b>，在本季节处于「
              <b>{chart.wangshuai.dayStatus}</b>」地位。
            </p>
            <p className="tiny muted mt-8">{chart.wangshuai.note}</p>
            <div className="mt-12 tiny" style={{ background: 'var(--bg-warm)', borderRadius: 10, padding: '10px 12px' }}>
              {Object.entries(chart.wangshuai.map).map(([k, v]) => (
                <span key={k} className="god-tag" style={{ margin: 2 }}>{k}:{v}</span>
              ))}
            </div>
          </div>

          <Remind icon="🔬">{chart.disclaimer}</Remind>
        </div>
      ) : (
        <div className="card">请输入有效的出生日期。</div>
      )}
    </div>
  )
}

// ---------------- 易经起卦 ----------------
function IChingPanel() {
  const [method, setMethod] = useState('time')
  const [nums, setNums] = useState({ n1: 8, n2: 3, n3: 5 })
  const [result, setResult] = useState(null)

  function cast(m) {
    setMethod(m)
    if (m === 'time') setResult(castByTime(new Date()))
    else if (m === 'coins') setResult(castByCoins())
    else setResult(castByNumbers(nums.n1, nums.n2, nums.n3))
  }

  useEffect(() => { if (!result) setResult(castByTime(new Date())) }, [result])

  return (
    <div>
      <div className="row wrap" style={{ gap: 10 }}>
        <button className={`btn ${method === 'time' ? 'btn-primary' : 'btn-soft'}`} onClick={() => cast('time')}>⏰ 时间起卦</button>
        <button className={`btn ${method === 'coins' ? 'btn-primary' : 'btn-soft'}`} onClick={() => cast('coins')}>🪙 随机三钱起卦</button>
        <button className={`btn ${method === 'numbers' ? 'btn-primary' : 'btn-soft'}`} onClick={() => { setMethod('numbers'); setResult(null) }}>🔢 数字起卦</button>
      </div>

      {method === 'numbers' && (
        <div className="card mt-16">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>输入三个数字</h3>
          <div className="row" style={{ gap: 10 }}>
            {['n1', 'n2', 'n3'].map((k) => (
              <Field key={k} label={k === 'n1' ? '上卦数' : k === 'n2' ? '下卦数' : '动爻数'}>
                <input type="number" value={nums[k]} onChange={(e) => setNums({ ...nums, [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
          <button className="btn btn-primary mt-12" onClick={() => cast('numbers')}>起卦</button>
        </div>
      )}

      {result && <HexagramResult result={result} />}

      <Remind icon="🔬">起卦只是「生成一个可观察的符号框架」，规则透明、可复现。真正的价值在于拿这个框架去结构化地思考问题，而不是「得出神谕」。</Remind>
    </div>
  )
}

function HexagramResult({ result }) {
  const { hexagram, changed, movingLines } = result
  return (
    <div className="card mt-16">
      <div className="spread">
        <span className="pill pill-indigo">{result.method}</span>
        {movingLines?.length > 0 && <span className="pill pill-amber">动爻 {movingLines.map((i) => i + 1).join('、')}</span>}
      </div>

      <div className="grid-2 mt-16" style={{ alignItems: 'center' }}>
        <div className="center">
          <div className="tiny muted">本卦</div>
          <div style={{ fontSize: 54, fontWeight: 800, color: 'var(--indigo-deep)' }}>{hexagram.upper.symbol}<br />{hexagram.lower.symbol}</div>
          <h3 className="mt-8">{hexagram.name}</h3>
          <p className="tiny muted">上 {hexagram.upper.name}（{hexagram.upper.nature}）· 下 {hexagram.lower.name}（{hexagram.lower.nature}）</p>
        </div>
        {changed && movingLines?.length > 0 ? (
          <div className="center" style={{ borderLeft: '1px solid var(--line)' }}>
            <div className="tiny muted">变卦</div>
            <div style={{ fontSize: 54, fontWeight: 800, color: 'var(--amber-deep)' }}>{changed.upper.symbol}<br />{changed.lower.symbol}</div>
            <h3 className="mt-8">{changed.name}</h3>
            <p className="tiny muted">动爻翻转后的方向</p>
          </div>
        ) : (
          <div className="center muted tiny">无动爻，本卦即为所得。</div>
        )}
      </div>

      {/* 六爻明细（三钱起卦时展示） */}
      {result.lineDetails && (
        <div className="mt-16">
          <div className="tiny muted" style={{ marginBottom: 8 }}>六爻（自下而上）</div>
          {result.lineDetails.map((l) => (
            <div key={l.index} className="row spread" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <span>{['初', '二', '三', '四', '五', '上'][l.index]}爻</span>
              <span style={{ fontSize: 22 }}>{lineSymbol(l.value % 2 === 1 ? 1 : 0, l.moving)}</span>
              <span className={l.moving ? 'pill pill-amber' : 'pill pill-gray'}>{l.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="feedback" style={{ background: 'rgba(69,84,155,0.06)', borderLeft: '4px solid var(--indigo)', marginTop: 16 }}>
        <h4 style={{ fontSize: 14 }}>怎么读？</h4>
        {result.explanation.map((e, i) => <p key={i} className="tiny muted mt-8">{e}</p>)}
        <p className="tiny mt-8" style={{ color: 'var(--indigo-deep)' }}>
          提示：卦象是开放的符号，结合你真正在问的问题去结构化思考，而不是寻找「标准答案」。
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      {children}
    </div>
  )
}