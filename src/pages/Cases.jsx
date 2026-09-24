// ============================================================
// 案例馆：玄学「案件档案」列表。
// ============================================================
import React from 'react'
import { useApp } from '../store/AppContext'
import { CASES } from '../data/cases'
import { navigate } from '../lib/router'
import { PageHead, Remind } from '../components/ui'

function diffLabel(d) {
  return d === 1 ? '新手' : d === 2 ? '初级' : '中级'
}
function diffTone(d) {
  return d === 1 ? 'teal' : d === 2 ? 'amber' : 'indigo'
}

export function CasesPage() {
  const { state } = useApp()

  return (
    <div>
      <PageHead title="🕵️ 玄学案件档案" sub="给你一个案例，你来判断。练的不是「算命」，是推理。" />
      <div className="grid-2">
        {CASES.map((c) => {
          const done = state.completedCases[c.id]
          return (
            <button key={c.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => navigate(`/case/${c.id}`)}>
              <div className="spread">
                <span className="pill pill-gray">案件 #{c.id.replace('case-', '')}</span>
                <div className="row">
                  <span className={`pill pill-${diffTone(c.difficulty)}`}>{diffLabel(c.difficulty)}</span>
                  {done && <span className="pill pill-teal">{done.score} 分</span>}
                </div>
              </div>
              <h3 className="mt-12" style={{ fontSize: 18 }}>{c.title}</h3>
              <p className="muted tiny mt-8">{c.subject}</p>
              <div className="row mt-12 tiny muted">
                <span>{c.blindTest ? '🎭 盲测' : '🧩 结构题'}</span>
                <span>·</span>
                <span>⏱ {c.minutes} 分钟</span>
                <span>·</span>
                <span>{c.challenges.length} 个挑战</span>
              </div>
            </button>
          )
        })}
      </div>
      <Remind icon="🕵️">案例没有「标准答案」，只有「推理质量」。这里关心的是你「怎么想」，而不是「猜没猜中」。</Remind>
    </div>
  )
}