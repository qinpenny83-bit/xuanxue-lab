// ============================================================
// R3 Phase 2 · 推理实验（科学实验工作流）
//   - ExperimentPage：30 个实验按 5 类分门别类，作为进入入口
//   - ExperimentRunner：十步实验流，每次只显示一步
//   问题 → 假设 → 预测 → 抽样本 → 观察 → 证据 → 反例 → 修正 → 结论 → 复盘
//   每步经 RECORD_EVIDENCE 写入真实 Evidence，最终 buildExperimentResult
//   产出 ExperimentResult + BeliefRevision 并归档。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import {
  EXPERIMENTS_V3,
  EXPERIMENT_CATEGORIES,
  getExperimentV3,
  TEN_STEP_TEMPLATE,
} from '../data/experiments-v3'
import {
  startExperiment,
  recordStep,
  buildExperimentResult,
} from '../agent/experimentEngine'
import { getHexagramProfile, getYao } from '../data/iching/hexagramProfile'
import { navigate } from '../lib/router'
import { PageHead, Remind, EmptyState, Pill } from '../components/ui'

const TYPE_BADGE = {
  hexagram: { label: '卦', tone: 'teal' },
  yao: { label: '爻', tone: 'indigo' },
  case: { label: '案例', tone: 'amber' },
  classic: { label: '经典', tone: 'teal' },
  term: { label: '术语', tone: 'gray' },
  tradition: { label: '传统', tone: 'amber' },
}

// ─────────────────────────────────────────────────────────────
export function ExperimentPage() {
  const { state } = useApp()
  const runs = state.experimentRuns || []
  const countByExp = runs.reduce((acc, r) => {
    acc[r.experimentId] = (acc[r.experimentId] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHead
        title="🧪 推理实验"
        sub="不是做练习，而是走一遍科学流程：提出假设 → 预测 → 抽样本 → 观察 → 找证据 → 找反例 → 修正结论。"
        right={
          <button className="btn btn-ghost" onClick={() => navigate('/exp-archive')}>
            🗂️ 我的实验档案{runs.length ? `（${runs.length}）` : ''}
          </button>
        }
      />

      {EXPERIMENT_CATEGORIES.map((cat) => {
        const list = EXPERIMENTS_V3.filter((e) => e.category === cat.id)
        return (
          <section key={cat.id} className="mt-16">
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>{cat.emoji} {cat.label}</h3>
              <span className="tiny muted">{cat.tip}</span>
            </div>
            <div className="grid-2 mt-12">
              {list.map((e) => (
                <button
                  key={e.id}
                  className="card card-hover"
                  style={{ textAlign: 'left' }}
                  onClick={() => navigate(`/exp/${e.id}`)}
                >
                  <div className="spread">
                    <span style={{ fontSize: 24 }}>{e.emoji}</span>
                    {countByExp[e.id] ? (
                      <Pill tone="teal">做过 {countByExp[e.id]} 次</Pill>
                    ) : (
                      <Pill tone="gray">未做</Pill>
                    )}
                  </div>
                  <h4 className="mt-8" style={{ fontSize: 16 }}>{e.title}</h4>
                  <p className="muted tiny mt-8">{e.subtitle}</p>
                  <p className="tiny mt-8" style={{ color: 'var(--indigo-deep)' }}>问题：{e.question}</p>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <Remind icon="🧠">
        判「对错」不是目的。这里训练的是：<b>你的结论是否经得起你亲手找到的证据和反例。</b>
      </Remind>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
export function ExperimentRunner({ id }) {
  const { dispatch } = useApp()
  const exp = getExperimentV3(id)
  const [run, setRun] = useState(() => (exp ? startExperiment(exp.id) : null))
  const [stepIdx, setStepIdx] = useState(0)
  const [input, setInput] = useState('')
  const [confidence, setConfidence] = useState(50)
  const [reviseChoice, setReviseChoice] = useState(null)
  const [doneResult, setDoneResult] = useState(null)

  if (!exp || !run) {
    return (
      <EmptyState
        title="找不到这个实验"
        action={<button className="btn" onClick={() => navigate('/exp')}>返回实验列表</button>}
      />
    )
  }

  const step = TEN_STEP_TEMPLATE[stepIdx]

  function writeEvidence(evidence) {
    evidence.forEach((partial) => dispatch({ type: 'RECORD_EVIDENCE', evidence: partial }))
  }

  function commit(stepKey, value, opts = {}) {
    const res = recordStep(run, stepKey, value, opts)
    writeEvidence(res.evidence)
    setRun(res.run)
    return res.run
  }

  function goto(n) {
    setStepIdx(n)
    setInput('')
    setReviseChoice(null)
    setConfidence(50)
  }

  // ── 每步「继续」逻辑 ──────────────────────────────────────
  function next() {
    const k = step.key
    if (k === 'question') {
      goto(1)
      return
    }
    if (k === 'sample') {
      const label = (run.sample || []).map((s) => s.label || s.id).join('、')
      commit('sample', `已抽取并查看样本：${label || '（无样本）'}`)
      goto(4)
      return
    }
    if (k === 'hypothesis' || k === 'conclusion') {
      commit(k, input.trim(), { confidence })
    } else if (k === 'revise') {
      const choice = REVISE_CHOICES.find((c) => c.key === reviseChoice)?.label || ''
      const text = input.trim()
      commit('revise', [choice, text].filter(Boolean).join('：'))
    } else {
      commit(k, input.trim())
    }
    goto(stepIdx + 1)
  }

  function finish() {
    const finalRun = commit('reflect', input.trim())
    const result = buildExperimentResult(finalRun)
    dispatch({ type: 'RECORD_EXPERIMENT_RUN', run: result })
    setDoneResult(result)
  }

  function restart() {
    setRun(startExperiment(exp.id))
    setStepIdx(0)
    setInput('')
    setConfidence(50)
    setReviseChoice(null)
    setDoneResult(null)
  }

  if (doneResult) {
    return <ExperimentDone exp={exp} result={doneResult} onRestart={restart} />
  }

  const valid =
    step.key === 'question' || step.key === 'sample'
      ? true
      : step.key === 'revise'
        ? reviseChoice !== null || input.trim().length >= 1
        : input.trim().length >= 1

  return (
    <div className="lesson-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/exp')}>← 推理实验</button>

      <div className="card mt-12">
        <div className="spread" style={{ alignItems: 'baseline' }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 22 }}>{exp.emoji}</span>
            <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>{exp.title}</h1>
          </div>
          <span className="tiny muted">第 {stepIdx + 1} / {TEN_STEP_TEMPLATE.length} 步</span>
        </div>

        <div className="mt-12">
          <Bar value={stepIdx} max={TEN_STEP_TEMPLATE.length - 1} tone="indigo" />
        </div>

        <h2 className="step-prompt">{step.label}</h2>
        <p className="muted tiny">{step.hint}</p>

        <div className="mt-16">
          {step.key === 'question' && <QuestionStep exp={exp} />}
          {step.key === 'hypothesis' && (
            <TextStep
              key={`hyp-${run.runId}`}
              value={input}
              onChange={setInput}
              placeholder="写下你此刻最相信的那个说法……"
              defaultVal={run.seededHypothesis}
            />
          )}
          {(step.key === 'hypothesis' || step.key === 'conclusion') && (
            <ConfidenceRow value={confidence} onChange={setConfidence} />
          )}
          {step.key === 'predict' && (
            <TextStep value={input} onChange={setInput} placeholder="先写预测，再去看样本……" />
          )}
          {step.key === 'sample' && <SampleStep run={run} />}
          {step.key === 'observe' && (
            <ObserveStep run={run} value={input} onChange={setInput} />
          )}
          {step.key === 'evidence' && (
            <TextStep value={input} onChange={setInput} placeholder="哪些样本支持了你的假设？逐条写下来……" />
          )}
          {step.key === 'counterexample' && (
            <TextStep value={input} onChange={setInput} placeholder="哪些样本不支持、甚至推翻了你？诚实记下来……" />
          )}
          {step.key === 'revise' && <ReviseStep choice={reviseChoice} onChange={setReviseChoice} value={input} onTextChange={setInput} />}
          {step.key === 'conclusion' && (
            <TextStep value={input} onChange={setInput} placeholder="写出修正后、带限定的结论……" />
          )}
          {step.key === 'reflect' && (
            <TextStep value={input} onChange={setInput} placeholder="这次实验，你最容易在哪一步出错？" />
          )}
        </div>

        <div className="row mt-16" style={{ justifyContent: 'space-between' }}>
          {stepIdx > 0 ? (
            <button className="btn btn-ghost" onClick={() => goto(stepIdx - 1)}>← 上一步</button>
          ) : (
            <span />
          )}
          {step.key === 'reflect' ? (
            <button className="btn btn-primary" disabled={!valid} onClick={finish}>✅ 完成实验并归档</button>
          ) : (
            <button className="btn btn-primary" disabled={!valid} onClick={next}>
              {step.key === 'question' ? '开始实验 →' : step.key === 'sample' ? '已查看样本，继续 →' : '记下并继续 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 各步子组件 ───────────────────────────────────────────────
function Bar({ value, max, tone = 'amber' }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(max, 1)) * 100)))
  return (
    <div className="bar">
      <div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function QuestionStep({ exp }) {
  return (
    <div>
      <div className="feedback" style={{ background: 'rgba(28,26,23,0.03)' }}>
        <p className="tiny muted">本实验要回答的问题：</p>
        <p style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{exp.question}</p>
      </div>
      <p className="muted tiny mt-12">
        实验预设假设（可修改）：<b>{exp.hypothesis}</b>
      </p>
      <p className="tiny muted mt-8">准备好后点「开始实验」，只需按部就班走完十步，无需预判结果。</p>
    </div>
  )
}

function ConfidenceRow({ value, onChange }) {
  return (
    <div className="metric-row" style={{ maxWidth: 340, marginTop: 12 }}>
      <label>信心</label>
      <input
        type="range"
        min={0}
        max={100}
        className="slider"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span style={{ fontWeight: 700, minWidth: 46, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

function TextStep({ value, onChange, placeholder, defaultVal }) {
  React.useEffect(() => {
    if (defaultVal && !value) onChange(defaultVal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="field">
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function SampleStep({ run }) {
  const samples = run.sample || []
  return (
    <div>
      <p className="tiny muted">本实验从真实卦/爻/案例/经典中做了<b>确定性抽取</b>（seed 可复现）。请先浏览这些样本：</p>
      <div className="grid-2 mt-12">
        {samples.map((s, i) => (
          <SampleCard key={`${s.type}-${s.id}-${i}`} s={s} />
        ))}
      </div>
    </div>
  )
}

function ObserveStep({ run, value, onChange }) {
  const samples = run.sample || []
  return (
    <div>
      <p className="tiny muted">对照下方样本，逐条记下你<b>真实看到</b>的结构/文本（不要写结论，只写观察到的事实）。</p>
      <div className="grid-2 mt-12">
        {samples.map((s, i) => (
          <SampleCard key={`${s.type}-${s.id}-${i}`} s={s} />
        ))}
      </div>
      <div className="field mt-12">
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="我观察到……"
        />
      </div>
    </div>
  )
}

function SampleCard({ s }) {
  const badge = TYPE_BADGE[s.type] || { label: s.type, tone: 'gray' }
  let facts = []
  if (s.type === 'yao') {
    const y = getYao(s.seq, s.pos)
    const p = getHexagramProfile(s.seq)
    if (y) {
      facts = [
        `${p?.name || ''}·${y.name}`,
        y.deweiLabel,
        y.zhongzheng ? '中正' : y.zhong ? '得中' : '失中',
        y.ying ? y.ying.type : '无应',
        y.originalText ? `爻辞：${y.originalText}` : null,
      ]
    }
  } else if (s.type === 'hexagram') {
    const p = getHexagramProfile(s.seq)
    facts = p ? [p.symbol, p.guaci ? `卦辞：${p.guaci}` : null] : []
  }

  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{s.label || s.id}</span>
        <span className={`pill pill-${badge.tone}`} style={{ fontSize: 11 }}>{badge.label}</span>
      </div>
      {facts.filter(Boolean).length > 0 && (
        <div className="tiny muted mt-8" style={{ lineHeight: 1.55 }}>
          {facts.filter(Boolean).map((f, i) => (
            <div key={i}>{f}</div>
          ))}
        </div>
      )}
    </div>
  )
}

const REVISE_CHOICES = [
  { key: 'need-revise', label: '需要修改假设' },
  { key: 'keep', label: '维持原假设' },
  { key: 'unsure', label: '还不确定' },
]

function ReviseStep({ choice, onChange, value, onTextChange }) {
  return (
    <div>
      <p className="tiny muted">诚实地判断：原来的说法是不是太绝对了？</p>
      <div className="row mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
        {REVISE_CHOICES.map((c) => (
          <button
            key={c.key}
            className={`btn btn-sm ${choice === c.key ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => onChange(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="field mt-12">
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="（选填）说说为什么这样判断……"
        />
      </div>
    </div>
  )
}

function ExperimentDone({ exp, result, onRestart }) {
  const br = result.beliefRevision
  const revised = !!br && !!br.revisedClaim && br.originalClaim && br.originalClaim !== br.revisedClaim
  return (
    <div className="lesson-body">
      <div className="center mt-12">
        <div style={{ fontSize: 44 }}>🔬</div>
        <h1 className="page-title">实验完成</h1>
        <p className="muted">{exp.emoji} {exp.title}</p>
      </div>

      {br ? (
        <div className="card mt-16">
          <h3 style={{ fontSize: 16 }}>🧭 观点变化记录</h3>
          <div className="mt-12">
            <p className="tiny muted">最初假设：</p>
            <p style={{ fontSize: 15, fontStyle: 'italic' }}>{br.originalClaim || '（未填写）'}</p>
            {br.originalConfidence != null && (
              <p className="tiny muted mt-8">初始信心 {br.originalConfidence}%</p>
            )}
            {br.revisedClaim && br.revisedClaim !== br.originalClaim ? (
              <>
                <p className="tiny muted mt-12">修正后的结论：</p>
                <p style={{ fontSize: 15 }}>{br.revisedClaim}</p>
                {br.revisedConfidence != null && (
                  <p className="tiny muted mt-8">修正后信心 {br.revisedConfidence}%</p>
                )}
              </>
            ) : null}
          </div>
          {br.counterEvidence && br.counterEvidence.length > 0 && (
            <div className="mt-12">
              <p className="tiny muted">你记录的反例/反面观察：</p>
              <ul className="clue-list mt-8">
                {br.counterEvidence.map((c, i) => <li key={i}>⚠️ {c}</li>)}
              </ul>
            </div>
          )}
          {revised ? (
            <div className="feedback good mt-12">
              <h4>✓ 你根据证据修正了观点</h4>
              <p className="tiny mt-8">「能否根据证据改变看法」比「答案对不对」更接近真正的成长。这已被记录进你的实验档案。</p>
            </div>
          ) : (
            <div className="feedback mt-12">
              <h4>✓ 实验已归档</h4>
              <p className="tiny mt-8">哪怕结论没变，诚实记录的过程本身就是有效学习。反例越少，越要警惕它可能是「单向印证」。</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card mt-16">
          <p>实验已记录。</p>
        </div>
      )}

      <div className="row mt-16" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/exp-archive')}>查看实验档案</button>
        <button className="btn btn-ghost" onClick={onRestart}>再做一次</button>
        <button className="btn btn-ghost" onClick={() => navigate('/exp')}>换个实验</button>
      </div>
    </div>
  )
}