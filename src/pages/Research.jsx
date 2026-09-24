// ============================================================
// 🎓 综合研究院（Research Institute）页面
// 四个专题，全部确定性交互，不依赖任何外部接口：
//   synthesis  跨知识综合分析：一张盘，六个维度，你自己决定从哪里开始
//   transfer   迁移挑战：把一个学院的结构，搬到另一个学院的陌生案例
//   research   研究模式：读资料 → 提取观点 → 比较 → 证据 → 解释 → 局限
//   master     出师挑战：完全陌生复杂案例，全程不主动提示，完成后生成能力报告
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { navigate } from '../lib/router'
import { getCase } from '../data/cases'
import { RESEARCH_INSTITUTE, getCurriculumNode } from '../data/curriculum'
import {
  SYNTHESIS_DIMENSIONS,
  SYNTHESIS_CASE_ID,
  TRANSFER_PROTOCOL,
  TRANSFER_SELFCHECK,
  RESEARCH_QUESTION,
  MASTER_CASE_ID,
  MASTER_ELIGIBILITY_NOTE,
} from '../data/research'
import { migrationChallenges } from '../agent/knowledgeMastery'
import { scoreMasterChallenge, masterVerdict, nextStageAfterMaster } from '../agent/masterChallenge'
import { Bar, EmptyState, Pill } from '../components/ui'

const OPTION_TYPES = ['choice', 'conclusion', 'why', 'counter', 'evidence', 'open', 'boundary', 'revision', 'counterfactual', 'dual']

// ────────────────────────────────────────────────────────────
// 研究院总览
// ────────────────────────────────────────────────────────────
export function ResearchPage() {
  const { state } = useApp()
  const summary = (state.researchProgress || { synthesis: [], transfers: [], researchNotes: [] })
  const counts = {
    synthesis: summary.synthesis.length,
    transfer: summary.transfers.length,
    research: summary.researchNotes.length,
    master: state.masterChallenge?.reports?.length || 0,
  }
  return (
    <div>
      <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
        <div>
          <h1 className="page-title">🎓 综合研究院</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>跨知识综合、迁移、独立研究与出师挑战。这里不教新结论，只检验你会不会用已经学过的东西。</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回学习地图</button>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        {RESEARCH_INSTITUTE.topics.map((t) => (
          <button key={t.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => navigate(`/research/${t.id}`)}>
            <div className="spread">
              <h3 style={{ margin: 0, fontSize: 16 }}>{t.title}</h3>
              <span className="pill pill-teal">已完成 {counts[t.id === 'research' ? 'research' : t.id]}</span>
            </div>
            <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="card mt-16" style={{ marginTop: 16, background: 'rgba(0,0,0,0.02)' }}>
        <h4 style={{ margin: 0, fontSize: 14 }}>🎓 研究院说明</h4>
        <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>
          四个专题按能力递进：先做「跨知识综合分析」建立综合视角，再用「迁移挑战」检验跨领域能力，
          「研究模式」训练独立研究，最后用「出师挑战」做全流程能力证明。建议学习阶段 L4 之后再进入。
        </p>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 专题一：跨知识综合分析（Synthesis Workshop）
// ────────────────────────────────────────────────────────────
const DIM_ORDER = ['dim-info', 'dim-structure', 'dim-strength', 'dim-time', 'dim-compare', 'dim-conclusion']

export function SynthesisWorkshop() {
  const { dispatch } = useApp()
  const cs = getCase(SYNTHESIS_CASE_ID)
  const [phase, setPhase] = useState('start') // start | dims | done
  const [dimIds, setDimIds] = useState([])
  const [dimIdx, setDimIdx] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)

  if (!cs) return <EmptyState title="找不到工作台案例" action={<button className="btn" onClick={() => navigate('/research')}>返回研究院</button>} />

  if (phase === 'start') {
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">专题一 · 跨知识综合分析</span>
        </div>
        <h2 className="mt-12" style={{ margin: '12px 0 4px', fontSize: 19 }}>🧭 从一张盘开始：你自己决定先看什么</h2>
        <p className="tiny muted" style={{ margin: '4px 0 12px', maxWidth: 620 }}>下面是一张综合案例。六个维度都已经摆好，但不告诉你顺序——你决定从哪里开始，剩下的按规范顺序走完。</p>

        <div className="card mt-12">
          <div className="tiny muted">案件 #{cs.id.replace('case-', '')} · {cs.title}</div>
          <ul className="mt-8" style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {cs.situation.map((s) => <li key={s} className="tiny" style={{ marginBottom: 4 }}>{s}</li>)}
          </ul>
        </div>

        <h4 className="mt-16" style={{ fontSize: 15, marginBottom: 8 }}>你想从哪个维度开始？（六个维度都重要，选择只是决定顺序）</h4>
        <div className="grid-2">
          {SYNTHESIS_DIMENSIONS.map((d) => (
            <button
              key={d.id}
              className="card card-hover"
              style={{ textAlign: 'left' }}
              onClick={() => {
                const rest = DIM_ORDER.filter((x) => x !== d.id)
                setDimIds([d.id, ...rest])
                setDimIdx(0)
                setPicked(null)
                setScore(0)
                setPhase('dims')
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15 }}>{d.emoji} {d.label}</h3>
              <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>{d.question}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'dims') {
    const dim = SYNTHESIS_DIMENSIONS.find((x) => x.id === dimIds[dimIdx])
    const refNode = getCurriculumNode(dim.refNode)
    const answered = picked !== null
    const isLast = dimIdx === dimIds.length - 1
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">维度 {dimIdx + 1} / {dimIds.length}</span>
        </div>
        <div className="mt-12" style={{ display: 'flex', gap: 4 }}>
          {dimIds.map((id, i) => (
            <div key={id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < dimIdx ? 'var(--teal)' : i === dimIdx ? 'var(--amber)' : 'rgba(0,0,0,0.08)' }} />
          ))}
        </div>
        <div className="card mt-12">
          <div className="tiny muted">{dim.emoji} {dim.label}{refNode ? ` · 关联「${refNode.title}」` : ''}</div>
          <h3 className="step-prompt" style={{ fontSize: 17 }}>{dim.question}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dim.options.map((o, i) => (
              <button
                key={i}
                className={`btn ${picked === null ? 'btn-ghost' : i === dim.options.findIndex((x) => x.correct) ? 'btn-primary' : 'btn-ghost'}`}
                style={{ textAlign: 'left', opacity: picked === null ? 1 : o.correct || picked === i ? 1 : 0.5 }}
                disabled={picked !== null}
                onClick={() => {
                  setPicked(i)
                  if (o.correct) setScore((s) => s + 1)
                }}
              >
                {o.text}
                {picked !== null && (o.correct ? ' ✓' : picked === i ? ' ✗' : '')}
              </button>
            ))}
          </div>
          {answered && (
            <div className={`feedback ${picked === dim.options.findIndex((x) => x.correct) ? 'good' : 'warn'} mt-12`}>
              <p className="tiny" style={{ margin: 0 }}>{dim.keyPoint}</p>
            </div>
          )}
          <div className="spread mt-12">
            <span className="tiny muted">答对 {score} / {dimIdx + 1}</span>
            {answered && (
              <button className="btn btn-primary btn-sm" onClick={() => {
                if (isLast) {
                  setPhase('done')
                  dispatch({ type: 'RECORD_RESEARCH', kind: 'synthesis', entry: { caseId: SYNTHESIS_CASE_ID, correct: score, total: 6 } })
                } else {
                  setDimIdx(dimIdx + 1)
                  setPicked(null)
                }
              }}>
                {isLast ? '完成综合分析 →' : '下一个维度 →'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // done
  return (
    <div>
      <div className="spread">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
        <span className="tiny muted">专题一 · 完成</span>
      </div>
      <div className="card mt-12">
        <h2 className="step-prompt" style={{ fontSize: 19 }}>综合小结</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <Bar value={score} max={6} tone={score >= 5 ? 'teal' : score >= 3 ? 'amber' : 'orange'} />
          </div>
          <span className="tiny muted">六个维度答对 {score} 个</span>
        </div>
        <p className="tiny mt-12" style={{ marginBottom: 0 }}>
          {score >= 5
            ? '你已经能独立走完综合分析路径，六个维度都能定位到关键。下一步：去案例馆做一次完整评分，把「会看」变成「能得分」。'
            : score >= 3
              ? '主干路径你已经掌握，但还有几个维度会滑向「数量直觉」或「单变量结论」。回到地图复习对应节点，再回来走一遍。'
              : '综合分析最忌讳跳步：先确认信息、再谈结构。建议先从地图的「日主强弱」「综合分析」章节重新走起，再回来挑战。'}
        </p>
        <div className="feedback good mt-12">
          <p className="tiny" style={{ margin: 0 }}>💡 案例核心：{cs.reveal.takeaway}</p>
        </div>
        <div className="spread mt-12" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate(`/case/${SYNTHESIS_CASE_ID}`)}>去案例馆做完整评分</button>
          <button className="btn btn-ghost" onClick={() => { setPhase('start') }}>再走一遍</button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 专题二：迁移挑战（Transfer Challenge）
// ────────────────────────────────────────────────────────────
export function TransferChallenge() {
  const { state, dispatch } = useApp()
  const [from, setFrom] = useState(null) // from-node
  const [to, setTo] = useState(null) // to-node
  const [stepIdx, setStepIdx] = useState(0)
  const [notes, setNotes] = useState({})
  const [checks, setChecks] = useState({})
  const [done, setDone] = useState(false)

  const challenges = migrationChallenges(state)

  if (done && from && to) {
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">专题二 · 完成</span>
        </div>
        <div className="card mt-12">
          <h2 className="step-prompt" style={{ fontSize: 19 }}>迁移完成 ✓</h2>
          <p className="tiny mt-8" style={{ marginBottom: 0 }}>
            你把「{from.title}」（{collegeLabel(from.college)}）的结构搬进了「{to.title}」（{collegeLabel(to.college)}）。
            迁移不是照搬术语，而是确认「结构对应物」、列出边界条件、并给自己留一个反例。
          </p>
          <div className="feedback good mt-12">
            <p className="tiny" style={{ margin: 0 }}>完成自检 {Object.values(checks).filter(Boolean).length} / {TRANSFER_SELFCHECK.length} 项。勾选越多，说明迁移越严谨。</p>
          </div>
          <div className="spread mt-12">
            <button className="btn btn-primary" onClick={() => navigate('/research/transfer')}>再来一次</button>
            <button className="btn btn-ghost" onClick={() => navigate('/map')}>回地图复习</button>
          </div>
        </div>
      </div>
    )
  }

  if (!challenges.length) {
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">专题二 · 迁移挑战</span>
        </div>
        <EmptyState
          title="还没有可迁移的结构"
          desc="迁移挑战需要你先把某个结构学到 4 级掌握（能应用）。先去学习地图掌握几个节点，再回来把结构搬到陌生场景。"
          action={<button className="btn btn-primary" onClick={() => navigate('/map')}>去学习地图</button>}
        />
      </div>
    )
  }

  if (!from) {
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">专题二 · 迁移挑战</span>
        </div>
        <h2 className="mt-12" style={{ margin: '12px 0 4px', fontSize: 19 }}>🧩 你已掌握的结构</h2>
        <p className="tiny muted" style={{ margin: '4px 0 12px', maxWidth: 620 }}>这些结构都达到了 4 级掌握，且在别的学院有可迁移的同构候选。选一个作为迁移的起点。</p>
        <div className="grid-2">
          {challenges.map(({ from: f }) => (
            <button key={f.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => { setFrom(f); setStepIdx(0); setNotes({}); setChecks({}); setDone(false) }}>
              <div className="spread">
                <h3 style={{ margin: 0, fontSize: 15 }}>{f.emoji} {f.title}</h3>
                <Pill tone="gray">{collegeLabel(f.college)}</Pill>
              </div>
              <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>{f.structure.slice(0, 60)}…</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!to) {
    const candidates = challenges.find((x) => x.from.id === from.id).to
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => setFrom(null)}>← 换一个结构</button>
          <span className="tiny muted">专题二 · 选择陌生场景</span>
        </div>
        <div className="card mt-12">
          <div className="tiny muted">起点结构：{from.emoji} {from.title}（{collegeLabel(from.college)}）</div>
          <p className="tiny mt-8" style={{ marginBottom: 0 }}>{from.structure}</p>
        </div>
        <h4 className="mt-16" style={{ fontSize: 15, marginBottom: 8 }}>把「{from.title}」的结构搬到哪个陌生场景？</h4>
        <div className="grid-2">
          {candidates.map((c) => (
            <button key={c.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => { setTo(c); setStepIdx(0); setNotes({}); setChecks({}) }}>
              <div className="spread">
                <h3 style={{ margin: 0, fontSize: 15 }}>{c.emoji} {c.title}</h3>
                <Pill tone="gray">{collegeLabel(c.college)}</Pill>
              </div>
              <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>{c.concept.slice(0, 60)}…</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // work phase: 3-step protocol
  const step = TRANSFER_PROTOCOL[stepIdx]
  const isLastStep = stepIdx === TRANSFER_PROTOCOL.length - 1
  return (
    <div>
      <div className="spread">
        <button className="btn btn-ghost btn-sm" onClick={() => setTo(null)}>← 换场景</button>
        <span className="tiny muted">步骤 {stepIdx + 1} / {TRANSFER_PROTOCOL.length}</span>
      </div>
      <div className="mt-12" style={{ display: 'flex', gap: 4 }}>
        {TRANSFER_PROTOCOL.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < stepIdx ? 'var(--teal)' : i === stepIdx ? 'var(--amber)' : 'rgba(0,0,0,0.08)' }} />
        ))}
      </div>
      <div className="card mt-12">
        <div className="tiny muted">{step.id === 't1' ? '回顾结构' : step.id === 't2' ? '陌生场景' : '迁移应用'}</div>
        <h3 className="step-prompt" style={{ fontSize: 17 }}>{step.desc}</h3>
        <div className="card mt-8" style={{ background: 'rgba(0,0,0,0.03)' }}>
          <p className="tiny" style={{ margin: 0 }}>
            <b>起点结构</b>（{from.title} / {collegeLabel(from.college)}）：{from.concept.slice(0, 80)}…
          </p>
          {stepIdx >= 1 && (
            <p className="tiny mt-8" style={{ margin: '8px 0 0' }}>
              <b>陌生场景</b>（{to.title} / {collegeLabel(to.college)}）：{to.concept.slice(0, 80)}…
            </p>
          )}
        </div>
        <textarea
          className="textarea mt-12"
          rows={4}
          style={{ width: '100%' }}
          placeholder={stepIdx === 2 ? '写你的迁移结论，并说明它在什么条件下不成立……' : '在这里记录你的思考……'}
          value={notes[step.id] || ''}
          onChange={(e) => setNotes((n) => ({ ...n, [step.id]: e.target.value }))}
        />
        {isLastStep && (
          <div className="mt-12">
            <h4 className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>反例自检（勾选你做到的）</h4>
            {TRANSFER_SELFCHECK.map((sc) => (
              <label key={sc.id} className="tiny" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                <input type="checkbox" checked={!!checks[sc.id]} onChange={(e) => setChecks((c) => ({ ...c, [sc.id]: e.target.checked }))} />
                <span>{sc.text}</span>
              </label>
            ))}
          </div>
        )}
        <div className="spread mt-12">
          <button className="btn btn-ghost btn-sm" disabled={stepIdx === 0} onClick={() => setStepIdx(stepIdx - 1)}>← 上一步</button>
          {isLastStep ? (
            <button
              className="btn btn-primary"
              disabled={!(notes.t3 || '').trim()}
              onClick={() => {
                setDone(true)
                dispatch({
                  type: 'RECORD_RESEARCH',
                  kind: 'transfer',
                  entry: { from: from.id, to: to.id, checks: Object.values(checks).filter(Boolean).length },
                })
              }}
            >
              完成迁移 →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setStepIdx(stepIdx + 1)}>下一步 →</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 专题三：研究模式（Research Mode）
// ────────────────────────────────────────────────────────────
export function ResearchMode() {
  const { dispatch } = useApp()
  const [stepIdx, setStepIdx] = useState(0)
  const [inputs, setInputs] = useState({})
  const [done, setDone] = useState(false)
  const rq = RESEARCH_QUESTION

  if (done) {
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">专题三 · 完成</span>
        </div>
        <div className="card mt-12">
          <h2 className="step-prompt" style={{ fontSize: 19 }}>研究笔记已保存 ✓</h2>
          <p className="tiny mt-8" style={{ marginBottom: 0 }}>你已经完成一轮完整研究：提取观点 → 比较 → 证据 → 解释 → 局限。研究不是一次性的，等你学了新内容，可以回来修订。</p>
          <div className="card mt-12" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <p className="tiny" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{inputs.note || '（空）'}</p>
          </div>
          <div className="spread mt-12">
            <button className="btn btn-primary" onClick={() => { setStepIdx(0); setInputs({}); setDone(false) }}>重新研究</button>
            <button className="btn btn-ghost" onClick={() => navigate('/research')}>回研究院</button>
          </div>
        </div>
      </div>
    )
  }

  const step = rq.steps[stepIdx]
  const isLast = stepIdx === rq.steps.length - 1
  return (
    <div>
      <div className="spread">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
        <span className="tiny muted">专题三 · 研究模式 · 步骤 {stepIdx + 1} / {rq.steps.length}</span>
      </div>
      <div className="mt-12" style={{ display: 'flex', gap: 4 }}>
        {rq.steps.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < stepIdx ? 'var(--teal)' : i === stepIdx ? 'var(--amber)' : 'rgba(0,0,0,0.08)' }} />
        ))}
      </div>

      <div className="card mt-12">
        <div className="tiny muted">{rq.emoji} 研究问题</div>
        <h2 className="step-prompt" style={{ fontSize: 18, marginTop: 4 }}>{rq.question}</h2>
      </div>

      {stepIdx === 0 && (
        <div className="card mt-12" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <h4 className="tiny" style={{ fontWeight: 700, marginBottom: 8 }}>资料（按立场分组，来源均为本产品课程与案例）</h4>
          {rq.materials.map((m) => (
            <div key={m.id} className="mt-8" style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="spread">
                <span className="tiny" style={{ fontWeight: 700 }}>{m.stance}</span>
                <span className="tiny muted">{m.from}</span>
              </div>
              <p className="tiny" style={{ margin: '4px 0 0' }}>{m.excerpt}</p>
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>📜 {m.source}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-12">
        <div className="tiny muted">{stepIdx + 1}. {step.title}</div>
        <p className="tiny mt-8" style={{ margin: '8px 0' }}>{step.desc}</p>
        <textarea
          className="textarea"
          rows={stepIdx === 2 ? 3 : 4}
          style={{ width: '100%' }}
          value={inputs[step.id] || ''}
          placeholder={stepIdx === 2 ? '例如：「数数量」的立场有案例 case-046 直接支持其不成立；「看结构」的主张有令地势框架支持，但权重设定仍是流派差异……' : ''}
          onChange={(e) => setInputs((x) => ({ ...x, [step.id]: e.target.value }))}
        />
        {stepIdx === 2 && (
          <div className="mt-8">
            <h4 className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>资料支持度快选（帮助组织证据）</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['数量派有案例支持', '结构派有框架支持', '两派权重差异是流派问题', '还缺足够证据'].map((o) => (
                <button key={o} className={`btn btn-sm ${(inputs.evidencePicks || []).includes(o) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => {
                  const cur = inputs.evidencePicks || []
                  setInputs((x) => ({ ...x, evidencePicks: cur.includes(o) ? cur.filter((c) => c !== o) : [...cur, o] }))
                }}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {isLast && (
          <div className="feedback good mt-12">
            <p className="tiny" style={{ margin: 0 }}>研究笔记会自动保存到你的研究记录里，之后可以在研究院总览看到完成次数。</p>
          </div>
        )}
        <div className="spread mt-12">
          <button className="btn btn-ghost btn-sm" disabled={stepIdx === 0} onClick={() => setStepIdx(stepIdx - 1)}>← 上一步</button>
          {isLast ? (
            <button
              className="btn btn-primary"
              disabled={!(inputs.s4 || '').trim()}
              onClick={() => {
                const note = rq.steps.map((s) => `【${s.title}】${inputs[s.id] || '（未填写）'}`).join('\n')
                setInputs((x) => ({ ...x, note }))
                setDone(true)
                dispatch({ type: 'RECORD_RESEARCH', kind: 'researchNote', entry: { questionId: rq.id, note } })
              }}
            >
              保存研究笔记 →
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!(inputs[step.id] || '').trim()} onClick={() => setStepIdx(stepIdx + 1)}>下一步 →</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 专题四：出师挑战（Master Challenge）
// ────────────────────────────────────────────────────────────
const UNKNOWN_REASON_LABELS = {
  'missing-evidence': '缺少关键证据',
  conflict: '信息互相矛盾',
  multi: '可能存在多个解释',
  knowledge: '我还没有学会相关知识',
  other: '说不太清楚，先保留判断',
}

export function MasterChallenge() {
  const { state, dispatch } = useApp()
  const cs = getCase(MASTER_CASE_ID)
  const [phase, setPhase] = useState('brief') // brief | solve | result
  const [cIdx, setCIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [unknownReason, setUnknownReason] = useState(null)
  const [conf, setConf] = useState(60)
  const [hintCount, setHintCount] = useState(0)
  const [hintShown, setHintShown] = useState(false)
  const [consulted, setConsulted] = useState(false)
  const [analysisText, setAnalysisText] = useState('')
  const [result, setResult] = useState(null)

  const unlocked = state.masteryProfile?.level >= 'L4' || (state.masterChallenge?.attempts?.length || 0) > 0

  if (!cs) return <EmptyState title="找不到出师案例" action={<button className="btn" onClick={() => navigate('/research')}>返回研究院</button>} />

  if (phase === 'brief') {
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">专题四 · 出师挑战</span>
        </div>
        {!unlocked && (
          <div className="feedback warn mt-12">
            <h4>🔒 建议先达到 L4 再挑战</h4>
            <p className="tiny mt-8" style={{ marginBottom: 0 }}>当前你的学习阶段尚未达到 L4（独立分析）。你可以直接尝试，但报告会更严格。先在地图完成更多节点，把握更大。</p>
          </div>
        )}
        <div className="card mt-12">
          <div className="tiny muted">案件 #{cs.id.replace('case-', '')} · {cs.title} · Level {cs.level} {cs.levelName}</div>
          <div className="feedback warn mt-8" style={{ borderLeftColor: 'var(--gold, #d4a017)' }}>
            <h4>🎓 出师挑战说明</h4>
            <p className="tiny mt-8" style={{ margin: 0 }}>{MASTER_ELIGIBILITY_NOTE}</p>
          </div>
          <h2 className="step-prompt" style={{ fontSize: 18 }}>案情</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {cs.situation.map((s) => <li key={s} className="tiny" style={{ marginBottom: 4 }}>{s}</li>)}
          </ul>
          <div className="spread mt-12">
            <button className="btn btn-ghost" onClick={() => navigate('/research')}>先不挑战</button>
            <button className="btn btn-primary" onClick={() => setPhase('solve')}>开始挑战 →</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const mc = result.mc
    const passed = mc.passed
    return (
      <div>
        <div className="spread">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
          <span className="tiny muted">出师报告</span>
        </div>
        <div className="card mt-12">
          <div className="spread">
            <h2 className="step-prompt" style={{ fontSize: 19 }}>{passed ? '🎉 出师报告' : '📋 能力报告'}</h2>
            <Pill tone={passed ? 'teal' : 'gray'}>{passed ? '通过' : '未通过'}</Pill>
          </div>
          <p className="tiny mt-8" style={{ marginBottom: 0 }}>{masterVerdict(mc.overall, mc.independence)}</p>

          <div className="mt-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {Object.entries(mc.dimensions).map(([k, v]) => (
              <div key={k} className="card" style={{ padding: 8 }}>
                <div className="tiny muted">{DIM_LABELS[k] || k}</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <div className="spread">
              <span className="tiny">综合得分（能力 + 独立性）</span>
              <span className="tiny" style={{ fontWeight: 700 }}>{mc.overall}</span>
            </div>
            <Bar value={mc.overall} max={100} tone={passed ? 'teal' : 'amber'} />
            <div className="spread mt-8">
              <span className="tiny">独立性（提示依赖）</span>
              <span className="tiny" style={{ fontWeight: 700 }}>{mc.independence}</span>
            </div>
            <Bar value={mc.independence} max={100} tone={mc.independence >= 75 ? 'teal' : 'amber'} />
          </div>

          <div className="mt-12">
            <h4 className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>你的优势</h4>
            {mc.strengths.map((s) => <p key={s} className="tiny" style={{ margin: '4px 0' }}>✅ {s}</p>)}
            <h4 className="tiny" style={{ fontWeight: 700, margin: '12px 0 6px' }}>仍存在的问题</h4>
            {mc.issues.map((s) => <p key={s} className="tiny" style={{ margin: '4px 0' }}>⚠️ {s}</p>)}
            <h4 className="tiny" style={{ fontWeight: 700, margin: '12px 0 6px' }}>值得训练的习惯</h4>
            <p className="tiny" style={{ margin: '4px 0' }}>🧭 {mc.habit}</p>
          </div>

          <div className="feedback good mt-12">
            <p className="tiny" style={{ margin: 0 }}>{nextStageAfterMaster(mc.overall)}</p>
          </div>

          <div className="spread mt-12">
            <button className="btn btn-primary" onClick={() => navigate('/growth')}>去看我的能力成长</button>
            <button className="btn btn-ghost" onClick={() => navigate('/research')}>回研究院</button>
          </div>
        </div>
      </div>
    )
  }

  // solve
  const ch = cs.challenges[cIdx]
  const isLast = cIdx === cs.challenges.length - 1
  const answered = selected !== null || ch.type === 'analysis' || ch.type === 'confidence'

  function commit(value, errorType) {
    setAnswers((a) => ({ ...a, [cIdx]: value }))
  }

  function next() {
    setSelected(null)
    setAnalysisText('')
    if (isLast) finish()
    else setCIdx(cIdx + 1)
  }

  function finish() {
    const r = scoreMasterChallenge(cs, { ...answers, unknownReason, hintCount, consultedKnowledge: consulted, confidence: conf })
    const passed = r.overall >= 80 && r.independence >= 75
    const mc = { ...r, passed }
    setResult({ mc })
    dispatch({
      type: 'RECORD_MASTER_CHALLENGE',
      attempt: {
        caseId: MASTER_CASE_ID,
        at: new Date().toISOString(),
        score: r.overall,
        baseScore: r.baseScore,
        independence: r.independence,
        passed,
        hintCount,
        consulted,
      },
      report: { ...mc, passed, overall: r.overall, independence: r.independence },
    })
    dispatch({ type: 'RECORD_CONFIDENCE', caseId: MASTER_CASE_ID, confidence: r.confidence, actual: r.actualQuality })
    setPhase('result')
  }

  const hasUnknownOption = (ch.options || []).some((o) => o.isUnknown)
  const showUnknown = OPTION_TYPES.includes(ch.type) && !hasUnknownOption && selected === null

  return (
    <div>
      <div className="spread">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')}>← 研究院</button>
        <span className="tiny muted">挑战 {cIdx + 1} / {cs.challenges.length} · 独立模式</span>
      </div>
      <div className="card mt-12">
        <div className="feedback warn" style={{ borderLeftColor: 'var(--gold, #d4a017)' }}>
          <p className="tiny" style={{ margin: 0 }}>🎓 独立挑战：不主动提示，提示会影响独立性评分。</p>
        </div>
        <h2 className="step-prompt" style={{ fontSize: 17 }}>{ch.prompt}</h2>

        {OPTION_TYPES.includes(ch.type) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(ch.options || []).map((o, i) => (
              <button
                key={i}
                className={`btn btn-ghost ${selected === i ? 'btn-primary' : ''}`}
                style={{ textAlign: 'left' }}
                disabled={selected !== null}
                onClick={() => {
                  if (o.isUnknown) {
                    setSelected('unknown')
                    setUnknownReason(null)
                    return
                  }
                  setSelected(i)
                  commit(i, o.errorType)
                }}
              >
                {o.text}
              </button>
            ))}
            {showUnknown && (
              <button className="btn btn-ghost" disabled={selected !== null} onClick={() => { setSelected('unknown'); setUnknownReason(null) }}>
                🤷 我目前无法判断
              </button>
            )}
          </div>
        )}

        {selected === 'unknown' && (
          <div className="mt-12">
            <h4 className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>为什么暂时无法判断？</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(UNKNOWN_REASON_LABELS).map(([k, label]) => (
                <button key={k} className={`btn btn-sm btn-ghost ${unknownReason === k ? 'btn-primary' : ''}`} disabled={unknownReason !== null} onClick={() => { setUnknownReason(k); commit('unknown', null) }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {ch.type === 'analysis' && (
          <div>
            <textarea
              className="textarea"
              rows={4}
              style={{ width: '100%' }}
              placeholder={ch.placeholder || '写下你的分析……'}
              value={analysisText}
              onChange={(e) => { setAnalysisText(e.target.value); commit(e.target.value) }}
            />
            <p className="tiny muted mt-8" style={{ margin: '8px 0 0' }}>提示方向（不影响评分）：{ch.keywords ? ch.keywords.slice(0, 5).join('、') : '列出你知道的与不确定的'}</p>
          </div>
        )}

        {ch.type === 'confidence' && (
          <div>
            <div className="spread">
              <span className="tiny muted">0 = 很没把握</span>
              <span className="tiny" style={{ fontWeight: 700 }}>{conf}</span>
              <span className="tiny muted">100 = 非常确定</span>
            </div>
            <input type="range" min={0} max={100} value={conf} style={{ width: '100%' }} onChange={(e) => { setConf(Number(e.target.value)); commit(Number(e.target.value)) }} />
          </div>
        )}

        <div className="spread mt-12">
          <button className="btn btn-ghost btn-sm" disabled={hintShown} onClick={() => { setHintShown(true); setHintCount((n) => n + 1) }}>
            💡 我需要提示（用掉一次独立性分）
          </button>
          <label className="tiny" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={consulted} onChange={(e) => setConsulted(e.target.checked)} />
            查过知识节点
          </label>
          <button className="btn btn-primary" disabled={!answered} onClick={next}>{isLast ? '提交并生成报告 →' : '下一题 →'}</button>
        </div>
        {hintShown && <p className="tiny muted mt-8" style={{ margin: '8px 0 0' }}>💡 {hintForMaster(cs, ch)}</p>}
      </div>
    </div>
  )
}

// 确定性提示文案（master 模式专用，一次扣独立性分）
function hintForMaster(cs, ch) {
  if (cs.infoSufficiency === 'insufficient') return '注意：这个案例的信息可能不足——别脑补补齐。'
  if (ch.type === 'dual') return '比较两种解释：哪种更容易被验证或推翻？而不是哪种更吓人。'
  if (ch.type === 'analysis') return '先列出你确认知道的，再列出你不确定的，最后才谈结论。'
  if (ch.type === 'boundary') return '信息不足时，「无法判断」也是一种判断，但要说明缺什么。'
  return '先别急着下结论，回头看看案例资料里有哪些关键事实。'
}

function collegeLabel(collegeId) {
  const map = {
    bazi: '八字', iching: '易经', methodology: '方法论', fengshui: '风水', 'shushu-history': '思想史',
    qimen: '奇门', liuren: '六壬', taiyi: '太乙', folk: '民俗', mystic: '神秘',
  }
  return map[collegeId] || collegeId
}

const DIM_LABELS = {
  info: '观察', rule: '结构', reasoning: '推理', counter: '反例', over: '证据', boundary: '边界',
}
