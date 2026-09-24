// ============================================================
// 🛤️ 求学之路（R7）：六段主线学习路径
// 展示：当前学徒等级 + 六段时间线 + 每段进度 + 核心必修节点 + 结业测验。
// 全部数据来自 pathEngine（确定性），不读取 LLM / 随机。
// ============================================================
import React, { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { PageHead, Pill, Bar, Remind } from '../components/ui'
import { PATH_STAGES } from '../data/pathStages'
import { getCurriculumNode } from '../data/curriculum'
import {
  pathSummary, stageQuiz, checkStageQuiz, nextCoreNode,
} from '../agent/pathEngine'
import { runAgent } from '../agent/localAgentEngine'
import { navigate } from '../lib/router'

const DIFF_LABEL = { 0: '入门', 1: '入门', 2: '基础', 3: '进阶', 4: '高阶', 5: '研究', 6: '研究', 7: '挑战' }

function QuizPanel({ stageKey, onPass }) {
  const { dispatch } = useApp()
  const quiz = useMemo(() => stageQuiz(stageKey), [stageKey])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState([])
  const [picked, setPicked] = useState(null)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState(null)
  const q = quiz[idx]

  function pick(i) {
    if (picked !== null) return
    setPicked(i)
    setAnswers((a) => [...a, { qId: q.qId, idx: i }])
  }
  function next() {
    if (idx + 1 >= quiz.length) {
      const r = checkStageQuiz(stageKey, answers)
      setResult(r)
      setDone(true)
      const stage = PATH_STAGES.find((s) => s.key === stageKey)
      dispatch({ type: 'RECORD_PATH_QUIZ', stageKey, stageName: stage?.name, passed: r.passed, score: r.score })
      if (r.passed && onPass) onPass()
      return
    }
    setIdx(idx + 1)
    setPicked(null)
  }

  if (done) {
    return (
      <div className="feedback good mt-12">
        <h4>{result.passed ? '🎉 本段结业！' : '📖 还差一点'}</h4>
        <p className="tiny mt-8">
          答对 {result.correct}/{result.total}（{result.score} 分）。{result.passed ? '可以进入下一段了。' : '回去复习错题对应的节点，再回来挑战。'}
        </p>
        {!result.passed && (
          <div className="mt-8">
            {result.detail.filter((d) => !d.correct).map((d) => {
              const n = getCurriculumNode(d.nodeId)
              return (
                <button key={d.qId} className="btn btn-ghost btn-sm" style={{ marginRight: 8 }} onClick={() => navigate(`/lesson/v3-${d.nodeId}`)}>
                  ↻ 复习：{n?.title || d.nodeId}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="card mt-12">
      <div className="spread">
        <h4 style={{ fontSize: 15 }}>{q.title}</h4>
        <span className="pill pill-gray">第 {idx + 1}/{quiz.length} 题</span>
      </div>
      <p className="mt-8" style={{ fontWeight: 700 }}>{q.prompt}</p>
      <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((o) => {
          const node = getCurriculumNode(q.nodeId)
          const src = node && node[q.kind]
          const rightIdx = src ? src.options.findIndex((x) => x.correct) : -1
          const chosen = picked === o.idx
          const showState = picked !== null
          return (
            <button
              key={o.idx}
              className={`btn ${showState && o.idx === rightIdx ? 'btn-primary' : showState && chosen ? 'btn-danger' : 'btn-ghost'}`}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => pick(o.idx)}
              disabled={picked !== null}
            >
              {o.text}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className="mt-8">
          <div className="tiny" style={{ color: 'var(--teal-deep, #0f7b6c)' }}>{q.explain}</div>
          <div className="row mt-8" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={next}>{idx + 1 >= quiz.length ? '查看结果' : '下一题 →'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function StageCard({ stage, progress, current, onStartQuiz }) {
  const [open, setOpen] = useState(false)
  const isCurrent = current === stage.key
  const quizPassed = progress.quiz && progress.quiz.passed
  const status = quizPassed ? '已结业' : progress.done > 0 ? '学习中' : '未开始'
  const curOrder = PATH_STAGES.find((s) => s.key === current)?.order || 1
  return (
    <div className={`card mt-12 ${isCurrent ? '' : 'dim'}`} style={{ borderLeft: `4px solid ${isCurrent ? 'var(--indigo, #4338ca)' : 'var(--line, #e5e1da)'}` }}>
      <div className="spread" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>{stage.emoji}</span>
            <h3 style={{ margin: 0, fontSize: 17 }}>第 {stage.order} 段 · {stage.name}</h3>
            <span className="pill pill-gray">目标 {stage.targetLevel}</span>
            {isCurrent && <span className="pill pill-indigo">◉ 当前位置</span>}
            {quizPassed && <span className="pill pill-teal">🏆 {status}</span>}
            {!quizPassed && progress.done > 0 && <span className="pill pill-amber">{status}</span>}
          </div>
          <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>{stage.desc}</p>
        </div>
        <div style={{ minWidth: 140 }}>
          <Bar value={progress.done} max={progress.total} tone={isCurrent ? 'indigo' : 'teal'} />
          <div className="tiny muted" style={{ marginTop: 4, textAlign: 'center' }}>{progress.done}/{progress.total} 必修节点</div>
        </div>
      </div>
      {open && (
        <div className="mt-12">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stage.coreNodeIds.map((id) => {
              const n = getCurriculumNode(id)
              const done = progress.doneIds.includes(id)
              return (
                <button key={id} className={`pill ${done ? 'pill-teal' : 'pill-gray'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => navigate(`/lesson/v3-${id}`)}>
                  {done ? '✓ ' : '○ '}{n?.emoji || '📘'} {n?.title || id}
                </button>
              )
            })}
          </div>
          <div className="row mt-12" style={{ justifyContent: 'flex-end' }}>
            {isCurrent && !quizPassed && (
              <button className="btn btn-primary btn-sm" onClick={onStartQuiz}>📝 阶段测验（{stageQuiz(stage.key).length} 题，答对 4/5 结业）</button>
            )}
            {!isCurrent && !quizPassed && (
              <span className="tiny muted">建议先完成第 {stage.order} 段（当前在第 {curOrder} 段）</span>
            )}
            {quizPassed && <span className="tiny" style={{ color: 'var(--teal-deep, #0f7b6c)' }}>✓ 已结业（{progress.quiz.best} 分）</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function PathPage() {
  const { state } = useApp()
  const summary = useMemo(() => pathSummary(state), [state])
  const agent = useMemo(() => runAgent(state), [state])
  const mp = agent.masteryProfile
  const next = nextCoreNode(state)
  const [quizStage, setQuizStage] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function startQuiz(key) {
    setQuizStage(key)
    setRefreshKey((k) => k + 1)
  }

  return (
    <div>
      <PageHead
        title="🛤️ 求学之路"
        sub="六段主线：从「不认识」到「能独立分析」。每个节点都是真实课程，每段结业有测验验证。"
        right={<span className="pill pill-indigo">{mp?.levelEmoji || '🌱'} 当前：{mp?.levelName || '观察者'}</span>}
      />

      <div className="card mt-16">
        <div className="spread" style={{ alignItems: 'flex-end' }}>
          <div>
            <h4 style={{ fontSize: 15 }}>核心必修进度</h4>
            <p className="tiny muted mt-4" style={{ marginBottom: 0 }}>已完成 {summary.masteredCore} / {summary.totalCore} 个核心必修节点 · 当前第 {summary.current.order} 段「{summary.current.name}」</p>
          </div>
          <Bar value={summary.masteredCore} max={summary.totalCore} tone="indigo" />
        </div>
        {next && (
          <Remind icon="🎯">
            下一步：<b>{next.emoji} {next.title}</b>（第 {next.stage.order} 段核心必修）
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 12 }} onClick={() => navigate(`/lesson/v3-${next.nodeId}`)}>去学习 →</button>
          </Remind>
        )}
      </div>

      {PATH_STAGES.map((s) => (
        <StageCard
          key={s.key}
          stage={s}
          progress={summary.stages.find((x) => x.key === s.key).progress}
          current={summary.currentKey}
          onStartQuiz={() => startQuiz(s.key)}
        />
      ))}

      {quizStage && <QuizPanel key={quizStage + refreshKey} stageKey={quizStage} onPass={() => setRefreshKey((k) => k + 1)} />}
    </div>
  )
}
