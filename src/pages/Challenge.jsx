// ============================================================
// ⚔️ 章节闯关（R9）：每个章节 10 题，答对 8 题通关（80%）。
// 题目全部来自该章节点的既有题库（变式优先），确定性抽题、不泄露答案。
// 通关结果写入 chapterQuizzes，并产生 Evidence（source=challenge）。
// ============================================================
import React, { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { PageHead, Pill } from '../components/ui'
import { COLLEGES, getChapter, getCurriculumNode } from '../data/curriculum'
import { chapterQuiz, checkChapterQuiz } from '../agent/pathEngine'
import { navigate } from '../lib/router'

// 全部章节按学院顺序展开（用于「下一关」导航，确定性）
const ALL_CHAPTERS = COLLEGES.flatMap((c) =>
  c.chapters.map((ch) => ({ id: ch.id, title: ch.title, collegeTitle: c.title, collegeEmoji: c.emoji, nodeCount: ch.nodes.length }))
)

function ChallengeQuiz({ chapterId, chapter, onPass }) {
  const { dispatch } = useApp()
  const quiz = useMemo(() => chapterQuiz(chapterId), [chapterId])
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
      const r = checkChapterQuiz(chapterId, answers)
      setResult(r)
      setDone(true)
      dispatch({ type: 'RECORD_CHAPTER_QUIZ', chapterId, chapterName: chapter?.title, passed: r.passed, score: r.score })
      if (r.passed && onPass) onPass()
      return
    }
    setIdx(idx + 1)
    setPicked(null)
  }
  function retry() {
    setIdx(0)
    setAnswers([])
    setPicked(null)
    setDone(false)
    setResult(null)
  }

  if (done) {
    const wrong = (result.detail || []).filter((d) => !d.correct)
    return (
      <div className={`feedback ${result.passed ? 'good' : 'warn'} mt-12`}>
        <h4>{result.passed ? '🎉 本章通关！' : '📖 还差一点'}</h4>
        <p className="tiny mt-8">
          答对 {result.correct}/{result.total}（{result.score} 分）。{result.passed ? '已达标，可以进入下一关。' : `答对 ${Math.ceil(result.total * 0.8)}/${result.total} 才能通关，复习错题对应的知识点后再来。`}
        </p>
        {wrong.length > 0 && (
          <div className="mt-8">
            {wrong.map((d) => {
              const n = getCurriculumNode(d.nodeId)
              return (
                <button key={d.qId} className="btn btn-ghost btn-sm" style={{ marginRight: 8 }} onClick={() => navigate(`/lesson/v3-${d.nodeId}`)}>
                  ↻ 复习：{n?.title || d.nodeId}
                </button>
              )
            })}
          </div>
        )}
        <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
          {!result.passed && <button className="btn btn-primary btn-sm" onClick={retry}>🔄 再挑战一次</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回地图</button>
        </div>
      </div>
    )
  }

  if (!q) {
    return (
      <div className="feedback warn mt-12">
        <h4>暂无题目</h4>
        <p className="tiny mt-8">该章节还没有可用题目，先学习本章任意知识点，再回来闯关。</p>
      </div>
    )
  }

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

export function ChallengePage({ chapterId }) {
  const { state } = useApp()
  const chapter = getChapter(chapterId)
  const rec = (state.chapterQuizzes || {})[chapterId] || null
  const [round, setRound] = useState(0)
  const idx = ALL_CHAPTERS.findIndex((c) => c.id === chapterId)
  const cur = idx >= 0 ? ALL_CHAPTERS[idx] : null
  const nextCh = idx >= 0 ? ALL_CHAPTERS[idx + 1] : null

  if (!chapter) {
    return (
      <div className="feedback warn mt-12">
        <h4>未找到该章节</h4>
        <p className="tiny mt-8"><button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回地图</button></p>
      </div>
    )
  }

  return (
    <div>
      <PageHead
        title={`⚔️ 章节闯关 · ${chapter.title}`}
        sub={`${cur ? `${cur.collegeEmoji} ${cur.collegeTitle} · ` : ''}本章 ${cur?.nodeCount ?? chapter.nodes.length} 个知识点，抽 10 题检验掌握，答对 8 题通关。`}
        right={
          rec ? (
            <Pill tone={rec.passed ? 'teal' : 'amber'}>{rec.passed ? '🏆 已通关' : `最佳 ${rec.best} 分`}</Pill>
          ) : (
            <Pill tone="gray">未挑战</Pill>
          )
        }
      />

      {rec && rec.passed && (
        <div className="feedback good mt-12">
          <h4>🎉 本章已通关</h4>
          <p className="tiny mt-8" style={{ marginBottom: 0 }}>最佳成绩 {rec.best} 分。可以再挑战刷新纪录，或进入下一关。</p>
        </div>
      )}

      <ChallengeQuiz key={`${chapterId}-${round}`} chapterId={chapterId} chapter={chapter} onPass={() => setRound((r) => r + 1)} />

      <div className="row mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/map')}>← 回地图</button>
        {nextCh && <button className="btn btn-primary btn-sm" onClick={() => navigate(`/challenge/${nextCh.id}`)}>下一关：{nextCh.title} →</button>}
      </div>
    </div>
  )
}
