// ============================================================
// 🗺️ 玄学大学学习地图（V3）
// 三学院分章节展示：🏯 八字 / ☯️ 易经 / 🧠 方法论 / 🎓 综合研究院
// 每个节点显示知识掌握状态（未接触/练习中/不稳定/已理解/掌握/长期未复习），
// 由 knowledgeMastery 引擎（真实行为 + 遗忘曲线）推导，非人工标签。
// ============================================================
import React, { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { knowledgeSummary, learningMap } from '../agent/knowledgeMastery'
import { runAgent } from '../agent/localAgentEngine'
import { getLesson } from '../data/lessons'
import { COLLEGES, RESEARCH_INSTITUTE, getCurriculumNode } from '../data/curriculum'
import { PATH_STAGES, stageOfNode } from '../data/pathStages'
import { pathSummary } from '../agent/pathEngine'
import { navigate } from '../lib/router'
import { Bar } from '../components/ui'

// 状态元信息（与 NODE_STATUS 对齐）
const STATUS_META = {
  fresh: { label: '🌱 未接触', cls: 'st-fresh' },
  practicing: { label: '📖 练习中', cls: 'st-practicing' },
  unstable: { label: '🌊 不稳定', cls: 'st-unstable' },
  stable: { label: '✅ 已理解', cls: 'st-stable' },
  mastered: { label: '🏆 掌握', cls: 'st-mastered' },
  review: { label: '🔁 待复习', cls: 'st-review' },
}

function NodeCard({ node, progress, isAgentRecommended }) {
  const m = node.mastery || { status: 'fresh', level: 0, unlocked: true }
  const meta = STATUS_META[m.status] || STATUS_META.fresh
  const locked = !m.unlocked
  const displayLevel = m.effectiveLevel ?? m.level
  const pStatus = progress?.status || 'not_started'
  const coreStage = stageOfNode(node.id)

  function open() {
    const lessonId = `v3-${node.id}`
    navigate(`/lesson/${lessonId}`)
  }

  // 进度状态标签（地图负责「我在哪里」）
  const progressLabel = locked
    ? '🔒 未解锁'
    : isAgentRecommended
      ? '★ Agent推荐'
      : pStatus === 'completed'
        ? '✓ 已完成'
        : pStatus === 'in_progress'
          ? `◐ 继续（第 ${Math.min(progress.currentQuestionIndex + 1, 99)} 题）`
          : '○ 开始'

  return (
    <button
      className={`map-node ${locked ? 'locked' : ''} ${pStatus === 'completed' ? 'done' : ''} ${m.status === 'review' ? 'review' : ''} ${isAgentRecommended ? 'agent-pick' : ''}`}
      onClick={open}
      style={{ textAlign: 'center', width: 172 }}
      disabled={locked}
    >
      <div className="node-emoji">{node.emoji}</div>
      <div className="node-title">{node.title}</div>
      {coreStage && <div className="tiny" style={{ color: 'var(--indigo, #4338ca)', fontWeight: 700, marginTop: 2 }}>★ 必修 · 第 {PATH_STAGES.find((s) => s.key === coreStage).order} 段</div>}
      {!coreStage && <div className="tiny muted" style={{ marginTop: 2 }}>选修</div>}
      <div className={`node-state ${locked ? '' : pStatus === 'completed' ? 'st-mastered' : pStatus === 'in_progress' ? 'st-practicing' : isAgentRecommended ? 'st-agent' : 'st-fresh'}`}>
        {progressLabel}
      </div>
      {locked ? (
        <div className="tiny muted" style={{ marginTop: 6 }}>先完成前置节点</div>
      ) : (
        <>
          <div className="mt-8">
            <Bar value={displayLevel} max={6} tone={m.status === 'review' ? 'indigo' : m.status === 'mastered' || m.status === 'stable' ? 'teal' : 'amber'} />
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {m.status === 'review' ? `已 ${m.daysSince} 天未复习` : `${displayLevel}/6 级掌握`}
          </div>
        </>
      )}
    </button>
  )
}

function ChapterBlock({ chapter, lessonProgress, agentNodeId, quizRec }) {
  const done = chapter.nodes.length > 0
  const passed = quizRec && quizRec.passed
  return (
    <section className="chapter-block" style={{ marginTop: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>{chapter.title}</h3>
          <p className="tiny muted" style={{ margin: '4px 0 0', maxWidth: 560 }}>{chapter.desc}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!done && <span className="pill pill-gray">建设中</span>}
          {done && (
            <>
              {passed && <span className="pill pill-teal">🏆 已通关</span>}
              {quizRec && !passed && <span className="pill pill-amber">最佳 {quizRec.best} 分</span>}
              <button className={`btn btn-sm ${passed ? 'btn-ghost' : 'btn-primary'}`} onClick={() => navigate(`/challenge/${chapter.id}`)}>
                ⚔️ 闯关
              </button>
            </>
          )}
        </div>
      </div>
      {done ? (
        <div className="map-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {chapter.nodes.map((n) => (
            <NodeCard key={n.id} node={n} progress={lessonProgress?.[n.id]} isAgentRecommended={agentNodeId === n.id} />
          ))}
        </div>
      ) : (
        <div className="empty-inline tiny muted" style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 10 }}>
          🚧 该章节正在建设中，完成后会按知识树解锁。
        </div>
      )}
    </section>
  )
}

function CollegeView({ college, lessonProgress, agentNodeId, chapterQuizzes }) {
  return (
    <div>
      <div className="spread" style={{ alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{college.emoji} {college.title}</h2>
          <p className="tiny muted" style={{ margin: '4px 0 0', maxWidth: 600 }}>{college.tagline}</p>
        </div>
      </div>
      {college.chapters.map((ch) => (
        <ChapterBlock key={ch.id} chapter={ch} lessonProgress={lessonProgress} agentNodeId={agentNodeId} quizRec={chapterQuizzes?.[ch.id]} />
      ))}
    </div>
  )
}

function ResearchView({ research, summary }) {
  const unlocked = summary.mastered >= 4
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 20 }}>🎓 综合研究院</h2>
      <p className="tiny muted" style={{ margin: '4px 0 12px', maxWidth: 600 }}>{research.tagline}</p>
      {!unlocked && (
        <div className="feedback warn mt-8">
          <h4>🔒 尚未解锁</h4>
          <p className="tiny mt-8">先掌握至少 4 个知识点（达到「能应用」级别），研究院才会开放。当前已掌握 {summary.mastered} 个。</p>
        </div>
      )}
      <div className="grid-2" style={{ marginTop: 12 }}>
        {research.topics.map((t) => {
          const locked = t.id === 'master' && !unlocked
          return (
            <button
              key={t.id}
              className={`card card-hover ${locked ? 'dim' : ''}`}
              style={{ textAlign: 'left' }}
              disabled={locked}
              onClick={() => navigate(`/research/${t.id}`)}
            >
              <h3 style={{ margin: 0, fontSize: 16 }}>{t.title}</h3>
              <p className="tiny muted mt-8" style={{ marginBottom: 0 }}>{t.desc}</p>
              {locked && <span className="pill pill-gray" style={{ marginTop: 8 }}>🔒 未解锁</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 主线模式：只展示当前段落的必修节点，按学院分组，聚焦不分散
function PathFocusView({ state, lessonProgress, agentNodeId }) {
  const ps = pathSummary(state)
  const cur = ps.current
  const map = learningMap(state)
  const nodeById = useMemo(() => {
    const m = new Map()
    for (const c of map) for (const ch of c.chapters) for (const n of ch.nodes) m.set(n.id, n)
    return m
  }, [map])
  const nodes = cur.coreNodeIds.map((id) => nodeById.get(id)).filter(Boolean)
  const groups = COLLEGES.map((c) => ({
    college: c,
    nodes: nodes.filter((n) => n.college === c.id),
  })).filter((g) => g.nodes.length > 0)
  const allDone = cur.progress.done >= cur.progress.total

  return (
    <div>
      <div className="spread" style={{ alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>
            {cur.emoji} 第 {cur.order} 段「{cur.name}」<span className="tiny muted" style={{ fontWeight: 400 }}>· 目标 {cur.targetLevel}</span>
          </h3>
          <p className="tiny muted" style={{ margin: '4px 0 0', maxWidth: 640 }}>{cur.desc}</p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => navigate('/path')}>
          {allDone ? '🏁 本段完成，去结业测验 →' : '📋 结业测验 →'}
        </button>
      </div>
      <div className="mt-8">
        <Bar value={cur.progress.done} max={cur.progress.total} tone="indigo" />
        <div className="tiny muted mt-8">
          已掌握 {cur.progress.done}/{cur.progress.total} 个必修节点
          {allDone ? '，可以参加结业测验' : `，再完成 ${cur.progress.total - cur.progress.done} 个即可结业`}
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.college.id} className="chapter-block" style={{ marginTop: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{g.college.emoji} {g.college.title}</h3>
          <p className="tiny muted" style={{ margin: '4px 0 0', maxWidth: 560 }}>{g.college.tagline}</p>
          <div className="map-row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {g.nodes.map((n) => (
              <NodeCard key={n.id} node={n} progress={lessonProgress?.[n.id]} isAgentRecommended={agentNodeId === n.id} />
            ))}
          </div>
        </section>
      ))}
      <div className="tiny muted mt-12">选修内容不在主线视图中，切回「全学院」即可自由探索全部 10 个学院。</div>
    </div>
  )
}

export function MapPage() {
  const { state } = useApp()
  const [tab, setTab] = useState('bazi')
  const [mode, setMode] = useState('all')
  const map = learningMap(state)
  const summary = knowledgeSummary(state)

  // Agent 推荐节点（★ 标记）：唯一一个「当前推荐」入口
  const agentNodeId = useMemo(() => {
    const agent = runAgent(state)
    const action = agent && agent.nextAction
    if (!action || action.type !== 'lesson') return null
    if (action.nodeId) return action.nodeId
    if (action.id) {
      const l = getLesson(action.id)
      return l ? l.nodeId : null
    }
    return null
  }, [state])

  const tabs = [
    ...COLLEGES.map((c) => ({ key: c.id, label: `${c.emoji} ${c.title}` })),
    { key: 'research', label: '🎓 综合研究院' },
  ]

  const college = map.find((c) => c.id === tab)

  return (
    <div>
      <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
        <div>
          <h1 className="page-title">🗺️ 玄学大学学习地图</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>三个学院 + 研究院。每个节点都告诉你：学过什么、会了什么、忘了什么。</p>
        </div>
        <div className="tiny muted">
          {summary.mastered} 掌握 · {summary.review} 待复习 · {summary.learning} 学习中
        </div>
      </div>

      {(() => {
        const ps = pathSummary(state)
        const cur = ps.current
        return (
          <div className="row mt-12" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="pill pill-indigo" style={{ cursor: 'pointer' }} onClick={() => navigate('/path')}>
              🛤️ 求学之路：第 {cur.order} 段「{cur.name}」{cur.progress.done}/{cur.progress.total}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/path')}>查看主线 →</button>
          </div>
        )
      })()}

      <div className="tiny muted mt-12" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>○ 开始</span>
        <span style={{ color: 'var(--amber-deep)', fontWeight: 700 }}>◐ 继续</span>
        <span style={{ color: 'var(--teal-deep)', fontWeight: 700 }}>✓ 已完成</span>
        <span style={{ color: 'var(--indigo-deep)', fontWeight: 700 }}>★ Agent推荐</span>
        <span>🔒 未解锁</span>
      </div>

      <div className="map-tabs mt-16" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {mode === 'all' && tabs.map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: mode === 'all' ? 'auto' : 0, display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm ${mode === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('all')}>🗺️ 全学院</button>
          <button className={`btn btn-sm ${mode === 'path' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('path')}>🛤️ 当前主线</button>
        </div>
      </div>

      <div className="map">
        {mode === 'path' ? (
          <PathFocusView state={state} lessonProgress={state.lessonProgress} agentNodeId={agentNodeId} />
        ) : tab === 'research' ? (
          <ResearchView research={RESEARCH_INSTITUTE} summary={summary} />
        ) : college ? (
          <CollegeView college={college} lessonProgress={state.lessonProgress} agentNodeId={agentNodeId} chapterQuizzes={state.chapterQuizzes} />
        ) : null}
      </div>
    </div>
  )
}
