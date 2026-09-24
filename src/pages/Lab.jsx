// ============================================================
// 实验室：把学到的带进现实，记录 → 复盘 → 验证判断。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { EXPERIMENTS, getExperiment } from '../data/experiments'
import { EXPLORE_CATEGORIES, EXPLORE_EXPERIMENTS, getExploreExperiment, exploreByCategory } from '../data/exploreExperiments'
import { resolveExploreMaterials, materialLabel } from '../lib/exploreMaterial'
import { generateExperimentReport } from '../lib/experimentReport'
import { todayString } from '../lib/storage'
import { navigate } from '../lib/router'
import { PageHead, Bar, EmptyState, Remind, Segmented, Pill } from '../components/ui'

const EXPLORE_DIFF = { 1: '入门', 2: '进阶', 3: '高阶', 4: '综合' }

// ---------------- 实验列表 ----------------
export function LabPage() {
  const { state } = useApp()
  const [tab, setTab] = useState('real')
  const [exploreId, setExploreId] = useState(null)

  if (exploreId) {
    return <ExploreRunner id={exploreId} onBack={() => setExploreId(null)} />
  }

  return (
    <div>
      <PageHead title="🧪 把玄学带进现实" sub="学完不是结束。用低成本实验验证判断：现实记录看「我」，知识探索看「材料」。" />
      <div className="mt-8">
        <Segmented
          items={[
            { value: 'real', label: `🧪 现实记录（${EXPERIMENTS.length}）` },
            { value: 'explore', label: `🔬 知识探索（${EXPLORE_EXPERIMENTS.length}）` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'real' ? (
        <>
          <div className="exp-grid mt-12">
            {EXPERIMENTS.map((e) => {
              const rec = state.experiments[e.id]
              const days = rec?.entries?.length || 0
              return (
                <button key={e.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => navigate(`/lab/${e.id}`)}>
                  <div className="spread">
                    <div style={{ fontSize: 28 }}>{e.emoji}</div>
                    {rec?.completed ? <span className="pill pill-teal">已完成</span> : rec ? <span className="pill pill-amber">进行中 {days}/{e.days} 天</span> : <span className="pill pill-gray">未开始</span>}
                  </div>
                  <h3 className="mt-12" style={{ fontSize: 18 }}>{e.title}</h3>
                  <p className="muted tiny mt-8">{e.reportIntro}</p>
                  {e.example && <p className="tiny mt-8" style={{ color: 'var(--indigo, #4338ca)' }}>💡 {e.example}</p>}
                  <div className="row mt-12 tiny muted">
                    <span>⏱ 每天约 {e.minutesPerDay} 分钟</span>
                    <span>·</span>
                    <span>{e.days} 天</span>
                  </div>
                  {rec?.startedAt && !rec.completed && (
                    <div className="mt-12"><Bar value={days} max={e.days} tone="amber" /></div>
                  )}
                </button>
              )
            })}
          </div>
          <Remind icon="🔬">实验结果不是为了证明玄学「准」，而是帮你观察：自己的判断是否经得起现实记录。</Remind>
        </>
      ) : (
        <ExploreGrid onOpen={setExploreId} />
      )}
    </div>
  )
}

// ---------------- 探索实验列表（按类别分组） ----------------
function ExploreGrid({ onOpen }) {
  const { state } = useApp()
  const doneIds = (state.evidence || [])
    .filter((e) => e.source === 'explore' && e.action === 'complete')
    .map((e) => e.targetId)

  return (
    <div className="mt-12">
      {EXPLORE_CATEGORIES.map((cat) => {
        const list = exploreByCategory(cat.id)
        return (
          <div key={cat.id} className="mt-12">
            <div className="spread">
              <h3 style={{ fontSize: 15, margin: 0 }}>{cat.emoji} {cat.label}（{list.length}）</h3>
              <span className="pill pill-gray">{cat.tip}</span>
            </div>
            <div className="exp-grid mt-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {list.map((exp) => {
                const done = doneIds.includes(exp.id)
                return (
                  <button key={exp.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => onOpen(exp.id)}>
                    <div className="spread">
                      <div style={{ fontSize: 24 }}>{exp.emoji}</div>
                      {done ? <span className="pill pill-teal">已完成</span> : <span className={`pill pill-${exp.level >= 3 ? 'amber' : 'gray'}`}>{EXPLORE_DIFF[exp.level] || `L${exp.level}`}</span>}
                    </div>
                    <h4 className="mt-12" style={{ fontSize: 15, marginBottom: 4 }}>{exp.title}</h4>
                    <p className="tiny muted" style={{ lineHeight: 1.5 }}>{exp.subtitle}</p>
                    <div className="tiny mt-8" style={{ color: 'var(--indigo, #4338ca)' }}>材料：{exp.material ? materialLabel(exp.material) : '—'}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <Remind icon="🔬">每个探索实验都是一份「打开材料的路径」：观察指引 → 对比 → 反思。完成即记录为 Evidence，进入能力闭环。</Remind>
    </div>
  )
}

// ---------------- 探索实验查看器 ----------------
function ExploreRunner({ id, onBack }) {
  const { state, dispatch } = useApp()
  const exp = getExploreExperiment(id)
  const [done, setDone] = useState(false)
  const [note, setNote] = useState('')

  if (!exp) {
    return <EmptyState title="找不到这个探索实验" action={<button className="btn" onClick={onBack}>返回实验室</button>} />
  }

  const evidenceDone = (state.evidence || []).some(
    (e) => e.source === 'explore' && (e.action === 'complete' || e.action === 'reflect') && e.targetId === exp.id
  )
  const resolved = resolveExploreMaterials(exp)

  function complete() {
    if (evidenceDone || done) return
    const hasNote = note.trim().length > 0
    dispatch({
      type: 'RECORD_EVIDENCE',
      evidence: {
        source: 'explore',
        action: hasNote ? 'reflect' : 'complete',
        targetType: 'experiment',
        targetId: exp.id,
        context: hasNote
          ? note.trim()
          : `${EXPLORE_CATEGORIES.find((c) => c.id === exp.category)?.label || exp.category} · ${exp.title}`,
        result: 'correct',
        masteryKey: exp.masteryKeys?.[0] || 'observation',
        errorTypes: exp.errorTypes || [],
      },
    })
    setDone(true)
  }

  return (
    <div className="lesson-body">
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← 实验室</button>
        <span className="pill pill-gray">{EXPLORE_CATEGORIES.find((c) => c.id === exp.category)?.label || exp.category}</span>
        <span className={`pill pill-${exp.level >= 3 ? 'amber' : 'indigo'}`}>难度 {EXPLORE_DIFF[exp.level] || exp.level}</span>
      </div>

      <div className="card mt-12">
        <div style={{ fontSize: 34 }}>{exp.emoji}</div>
        <h1 className="page-title" style={{ fontSize: 24, marginTop: 6 }}>{exp.title}</h1>
        {exp.subtitle && <p className="muted">{exp.subtitle}</p>}

        <div className="mt-16">
          <h3 style={{ fontSize: 15 }}>📦 材料：{resolved.mainLabel}</h3>
          {resolved.main ? (
            <div className="card mt-8" style={{ background: 'var(--bg-warm, #faf7f0)' }}>
              <p className="guaci-quote" style={{ fontSize: 15 }}>{resolved.main.body}</p>
              {resolved.main.note && <p className="tiny muted mt-8">{resolved.main.note}</p>}
            </div>
          ) : (
            <p className="tiny muted mt-8">材料内容「暂无可靠整理」。</p>
          )}
        </div>

        {resolved.compare && (
          <div className="mt-16">
            <h3 style={{ fontSize: 15 }}>🆚 对照：{resolved.compareLabel}</h3>
            <div className="card mt-8" style={{ background: 'var(--bg-warm, #faf7f0)' }}>
              <p className="guaci-quote" style={{ fontSize: 15 }}>{resolved.compare.body}</p>
              {resolved.compare.note && <p className="tiny muted mt-8">{resolved.compare.note}</p>}
            </div>
          </div>
        )}

        <div className="mt-16">
          <h3 style={{ fontSize: 15 }}>🔍 观察指引</h3>
          <ol className="mt-8" style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(exp.focus || []).map((f, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>{f}</li>)}
          </ol>
        </div>

        {exp.reflection && (
          <div className="mt-16" style={{ borderLeft: '3px solid var(--indigo, #4338ca)', paddingLeft: 12 }}>
            <h3 style={{ fontSize: 15 }}>💭 收尾反思</h3>
            <p className="mt-6" style={{ fontSize: 14, lineHeight: 1.7 }}>{exp.reflection}</p>
          </div>
        )}

        {(exp.relatedTerms || []).length > 0 && (
          <p className="tiny muted mt-12">关联术语：{exp.relatedTerms.join('、')}</p>
        )}

        <div className="mt-16">
          {evidenceDone || done ? (
            <div className="feedback good">
              <h4>✓ 已记录为 Evidence</h4>
              <p className="tiny mt-8">这次探索已写入能力档案，Agent 会根据它调整下一步推荐。</p>
              <button className="btn btn-ghost btn-sm mt-12" onClick={onBack}>返回实验室 →</button>
            </div>
          ) : (
            <>
              <div className="field">
                <label style={{ fontSize: 14, fontWeight: 600 }}>写下你这次的观察（可选，写下一句即可进入能力闭环）</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：我发现……/ 我的原以为被推翻了……" />
              </div>
              <button className="btn btn-primary btn-lg btn-block mt-8" onClick={complete}>✔ 我完成了这次探索</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- 实验运行 ----------------
export function LabRunner({ id }) {
  const { state, dispatch } = useApp()
  const exp = getExperiment(id)
  const rec = state.experiments[id]

  if (!exp) {
    return <EmptyState title="找不到这个实验" action={<button className="btn" onClick={() => navigate('/lab')}>返回实验室</button>} />
  }

  // 未开始 → 引导
  if (!rec) return <LabIntro exp={exp} id={id} />

  // 已完成 → 报告
  if (rec.completed) return <LabReport exp={exp} rec={rec} id={id} />

  // 进行中 → 每日记录
  return <LabLog exp={exp} rec={rec} id={id} />
}

function LabIntro({ exp, id }) {
  const { dispatch } = useApp()
  const [assumption, setAssumption] = useState('')

  function start() {
    dispatch({ type: 'START_EXPERIMENT', experimentId: id, nodeId: exp.nodeId, assumption: assumption.trim() })
  }

  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lab')}>← 实验室</button>
      <div className="card mt-12">
        <div style={{ fontSize: 40 }}>{exp.emoji}</div>
        <h1 className="page-title" style={{ fontSize: 26 }}>{exp.title}</h1>
        <p className="muted">{exp.reportIntro}</p>
        <div className="row mt-12 tiny muted">
          <span>📅 {exp.days} 天</span>
          <span>·</span>
          <span>⏱ 每天约 {exp.minutesPerDay} 分钟</span>
        </div>

        <h3 className="mt-20" style={{ fontSize: 16 }}>先写下一个假设</h3>
        <p className="muted tiny mt-8">{exp.assumptionHint}</p>
        {exp.example && (
          <div className="mt-8" style={{ borderLeft: '3px solid var(--indigo, #4338ca)', paddingLeft: 12 }}>
            <div className="tiny" style={{ fontWeight: 700, color: 'var(--indigo, #4338ca)' }}>💡 示例</div>
            <p className="mt-4" style={{ fontSize: 13, lineHeight: 1.7 }}>{exp.example}</p>
          </div>
        )}
        <div className="mt-12 field">
          <textarea rows={2} value={assumption} onChange={(e) => setAssumption(e.target.value)} placeholder="我的假设是……" />
        </div>
        <div className="mt-8 wrap" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {exp.assumptionPresets.map((p) => (
            <button key={p} className="btn btn-soft btn-sm" onClick={() => setAssumption(p)}>{p}</button>
          ))}
        </div>

        <Remind icon="🔬">记录不是为了「验证玄学」，而是验证你自己的判断。诚实记录最重要。</Remind>

        <button className="btn btn-primary btn-lg btn-block" onClick={start}>开始实验</button>
      </div>
    </div>
  )
}

function LabLog({ exp, rec, id }) {
  const { dispatch } = useApp()
  const day = (rec.entries?.length || 0) + 1
  const [metrics, setMetrics] = useState(() => { const o = {}; exp.metrics.forEach((m) => (o[m.key] = 5)); return o })
  const [notes, setNotes] = useState(() => { const o = {}; exp.noteFields.forEach((f) => (o[f.key] = '')); return o })
  const [saved, setSaved] = useState(false)

  function submit() {
    dispatch({
      type: 'LOG_EXPERIMENT',
      experimentId: id,
      entry: { at: todayString(), metrics, notes },
    })
    setSaved(true)
  }

  const enough = (rec.entries?.length || 0) + (saved ? 1 : 0) >= exp.days

  function finish() {
    dispatch({ type: 'COMPLETE_EXPERIMENT', experimentId: id, nodeId: exp.nodeId })
  }

  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lab')}>← 实验室</button>
      <div className="card mt-12 log-form">
        <div className="spread">
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>{exp.emoji} {exp.title}</h1>
            <p className="muted tiny">第 {Math.min(day, exp.days)} 天 / 共 {exp.days} 天</p>
          </div>
          {(rec.entries?.length || 0) > 0 && <span className="pill pill-amber">已记录 {rec.entries.length} 天</span>}
        </div>

        {saved ? (
          <div className="feedback good mt-16">
            <h4>✓ 今天已记录</h4>
            <p className="tiny mt-8">不错，明天再来记一次。真正的观察需要时间。</p>
            <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
              {enough ? (
                <button className="btn btn-primary" onClick={finish}>生成我的实验报告 →</button>
              ) : (
                <button className="btn btn-ghost" onClick={() => navigate('/growth')}>去成长页看看</button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-16">
              {exp.metrics.map((m) => (
                <div key={m.key} className="metric-row">
                  <label>{m.label}</label>
                  <input type="range" min={m.min} max={m.max} className="slider" value={metrics[m.key]} onChange={(e) => setMetrics({ ...metrics, [m.key]: Number(e.target.value) })} />
                  <span style={{ fontWeight: 700 }}>{metrics[m.key]}</span>
                </div>
              ))}
            </div>

            {exp.noteFields.map((f) => (
              <div key={f.key} className="field">
                <label>{f.label}</label>
                <textarea rows={2} value={notes[f.key]} onChange={(e) => setNotes({ ...notes, [f.key]: e.target.value })} placeholder={f.placeholder} />
              </div>
            ))}

            <button className="btn btn-primary btn-block mt-12" onClick={submit}>记录今天的状态</button>
          </>
        )}
      </div>
    </div>
  )
}

function LabReport({ exp, rec, id }) {
  const report = generateExperimentReport(exp, rec.entries || [], rec.assumption || '')

  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lab')}>← 实验室</button>
      <div className="center mt-12">
        <div style={{ fontSize: 44 }}>🔬</div>
        <h1 className="page-title">我的实验报告</h1>
        <p className="muted">{exp.title}</p>
      </div>

      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>🗓 记录概览</h3>
        <p className="mt-8" style={{ fontSize: 15 }}>共记录 <b>{report.daysRecorded}</b> / {report.totalDays} 天，整体波动度为 <b>{report.volatility}</b>。</p>
      </div>

      <div className="card mt-16">
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>📈 数据变化</h3>
        <div className="grid-2">
          {report.metrics.map((m) => (
            <div key={m.key} className="report-metric">
              <div className="spread">
                <span style={{ fontWeight: 700 }}>{m.label}</span>
                <span className={m.trend === '上升' ? 'trend-up' : m.trend === '下降' ? 'trend-down' : 'trend-flat'}>
                  {m.trend} {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
              </div>
              <p className="tiny muted mt-8">前半平均 {m.mean1} → 后半平均 {m.mean2} · {m.consistency}</p>
              <div className="mt-8"><Bar value={m.mean2} max={10} tone={m.trend === '下降' ? 'indigo' : 'teal'} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>⚖️ 假设 vs 记录</h3>
        <p className="muted tiny mt-8">你当时的假设：</p>
        <p className="mt-8" style={{ fontStyle: 'italic', fontSize: 15 }}>{rec.assumption ? `「${rec.assumption}」` : '（未填写假设）'}</p>
        <div className="mt-12">
          <span className={`pill ${report.judgement.verdict === '基本支持' ? 'pill-teal' : report.judgement.verdict === '部分不一致' ? 'pill-red' : 'pill-gray'}`}>
            结论：{report.judgement.verdict}
          </span>
        </div>
        {report.judgement.supported?.length > 0 && (
          <ul className="clue-list mt-12">{report.judgement.supported.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>
        )}
        {report.judgement.mismatched?.length > 0 && (
          <ul className="clue-list mt-12">{report.judgement.mismatched.map((s, i) => <li key={i}>✗ {s}</li>)}</ul>
        )}
        {report.judgement.undecided?.length > 0 && (
          <ul className="clue-list mt-12">{report.judgement.undecided.map((s, i) => <li key={i}>？ {s}</li>)}</ul>
        )}
        <p className="tiny muted mt-8">{report.judgement.note}</p>
      </div>

      {/* V1.5：实验复盘 */}
      <ReviewSection id={id} />

      <Remind icon="🔬">{report.disclaimer}</Remind>

      <div className="row mt-8" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={() => navigate('/growth')}>去看成长报告</button>
        <button className="btn btn-ghost" onClick={() => navigate(`/lab/${id}`)}>回顾记录</button>
      </div>
    </div>
  )
}

// ---------------- 实验复盘（假设 → 实验 → 复盘 → 修正） ----------------
const REVIEW_CHOICES = [
  { key: 'longer', label: '观察时间更长', hint: '有些模式需要更久才能显现。' },
  { key: 'more-dims', label: '增加记录维度', hint: '多记一个变量，结论会更稳。' },
  { key: 'change-assumption', label: '改变假设', hint: '也许你最初的问法本身需要调整。' },
  { key: 'add-control', label: '增加对照', hint: '没有对比，很难判断是「规律」还是「巧合」。' },
  { key: 'give-up', label: '暂时放弃这个判断', hint: '数据还不够，诚实地放下也是一种结论。' },
]

function ReviewSection({ id }) {
  const { state, dispatch } = useApp()
  const review = state.experimentReviews?.[id]
  const [choice, setChoice] = useState(null)
  const [note, setNote] = useState('')

  if (review) {
    return (
      <div className="card mt-16">
        <h3 style={{ fontSize: 16 }}>🧭 已复盘</h3>
        <p className="mt-8" style={{ fontSize: 15 }}>
          如果重来一次，你会：<b>{REVIEW_CHOICES.find((c) => c.key === review.choice)?.label || review.choice}</b>
        </p>
        {review.note && <p className="tiny muted mt-8">你的补充：{review.note}</p>}
        <p className="tiny muted mt-12">这就是完整的闭环：假设 → 实验 → 复盘 → 修正。带着这个修正，去做下一个实验。</p>
      </div>
    )
  }

  function submit() {
    if (!choice) return
    dispatch({ type: 'REVIEW_EXPERIMENT', experimentId: id, choice, note: note.trim() })
  }

  return (
    <div className="card mt-16" style={{ borderColor: 'var(--indigo)', borderLeft: '4px solid var(--indigo)' }}>
      <h3 style={{ fontSize: 16 }}>🧭 实验复盘</h3>
      <p className="mt-8">如果重新做一次，你会改变什么？</p>

      <div className="mt-12">
        {REVIEW_CHOICES.map((c) => (
          <button
            key={c.key}
            className={`option ${choice === c.key ? 'correct' : ''}`}
            onClick={() => setChoice(c.key)}
          >
            <span style={{ fontWeight: 600 }}>{c.label}</span>
            <span className="tiny muted" style={{ marginLeft: 8 }}>{c.hint}</span>
          </button>
        ))}
      </div>

      <div className="field mt-12">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="（可选）写下你的复盘想法……" />
      </div>

      <button className="btn btn-primary mt-12" disabled={!choice} onClick={submit}>记下这次复盘</button>
    </div>
  )
}