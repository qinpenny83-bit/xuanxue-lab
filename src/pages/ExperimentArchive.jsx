// ============================================================
// R3 Phase 2 · 实验档案（我的易学推理实验记录）
//   把 experimentRuns 组织成「假设 → 证据 → 反例 → 修正」的可回顾档案。
//   全部来自 buildExperimentArchive（纯函数），不伪造任何内容。
// ============================================================
import React from 'react'
import { useApp } from '../store/AppContext'
import { buildExperimentArchive } from '../agent/experimentEngine'
import { EXPERIMENT_CATEGORIES } from '../data/experiments-v3'
import { navigate } from '../lib/router'
import { PageHead, EmptyState, Remind } from '../components/ui'

function fmtTime(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ExperimentArchivePage() {
  const { state } = useApp()
  const runs = state.experimentRuns || []
  const archive = buildExperimentArchive(runs)

  if (!archive.runCount) {
    return (
      <div>
        <PageHead title="🗂️ 我的推理实验档案" sub="假设、证据、反例、修正——都记在这里，形成你的「易学推理实验记录」。" />
        <EmptyState
          title="还没有实验记录"
          desc="去做一个推理实验，走一遍完整十步，你的观点变化就会出现在这里。"
          action={<button className="btn btn-primary" onClick={() => navigate('/exp')}>去做第一个实验</button>}
        />
      </div>
    )
  }

  const catOf = (id) => EXPERIMENT_CATEGORIES.find((c) => c.id === id)

  return (
    <div>
      <PageHead
        title="🗂️ 我的推理实验档案"
        sub="假设 → 证据 → 反例 → 修正：你的每一次观点变化，都是可回看的成长轨迹。"
        right={<button className="btn btn-ghost" onClick={() => navigate('/exp')}>去做新实验</button>}
      />

      <div className="grid-4 mt-8">
        <StatCard label="实验次数" value={archive.runCount} emoji="🧪" />
        <StatCard label="提出假设" value={archive.hypothesisCount} emoji="💡" />
        <StatCard label="记录反例" value={archive.counterexampleCount} emoji="🔨" />
        <StatCard label="观点修正" value={archive.revisionCount} emoji="🧭" />
      </div>

      {archive.byExperiment.map((group) => {
        const cat = catOf(group.category)
        return (
          <section key={group.experimentId} className="card mt-16">
            <div className="spread" style={{ alignItems: 'baseline' }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>
                {cat ? `${cat.emoji} ` : ''}{group.title}
              </h3>
              <span className="tiny muted">共 {group.runs.length} 次</span>
            </div>

            <div className="mt-12">
              {group.runs.map((r, i) => {
                const br = r.beliefRevision
                const revised = !!br && !!br.revisedClaim && !!br.originalClaim && br.originalClaim !== br.revisedClaim
                return (
                  <div key={r.runId} className="run-row" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span className="tiny muted">第 {i + 1} 次 {fmtTime(r.completedAt) ? `· ${fmtTime(r.completedAt)}` : ''}</span>
                      {revised ? (
                        <span className="pill pill-teal">已修正观点</span>
                      ) : br && br.counterEvidence?.length ? (
                        <span className="pill pill-amber">发现反例</span>
                      ) : (
                        <span className="pill pill-gray">未修正</span>
                      )}
                    </div>

                    {r.hypothesis && (
                      <p className="tiny muted mt-8">假设：<span style={{ fontStyle: 'italic' }}>{r.hypothesis}</span></p>
                    )}
                    {br && br.counterEvidence?.length > 0 && (
                      <p className="tiny mt-8" style={{ color: 'var(--amber-deep, #8a6d1a)' }}>
                        反例：{br.counterEvidence.join('；')}
                      </p>
                    )}
                    {r.conclusion && (
                      <p className="mt-8" style={{ fontSize: 14 }}>
                        结论：{r.conclusion}
                      </p>
                    )}
                    {br && br.reason && (
                      <p className="tiny muted mt-8">修正理由：{br.reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <Remind icon="🧭">
        档案不评判「你的结论对不对」，只忠实记录：<b>你有没有为结论找过证据、有没有主动找过反例、有没有根据证据修正过自己。</b>
      </Remind>
    </div>
  )
}

function StatCard({ label, value, emoji }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
      <div className="tiny muted mt-4">{label}</div>
    </div>
  )
}