// ============================================================
// 我的成长：等级、能力雷达、学习统计、常见错误、成就、数据备份。
// ============================================================
import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import { levelForXp, MASTERY_LEVELS } from '../game/levels'
import { ACHIEVEMENTS } from '../game/achievements'
import { runAgent } from '../agent/localAgentEngine'
import { topErrors, ERROR_TYPES } from '../agent/errors'
import { KNOWLEDGE_NODES, getNode } from '../data/knowledge'
import { CASES } from '../data/cases'
import { downloadJSON, importJSON } from '../lib/storage'
import { buildEvolutionTimeline } from '../lib/reasoningTrace'
import { errorMuseumTrend } from '../agent/errorMuseum'
import { MASTERY_DIMENSIONS } from '../agent/masteryEngine'
import { masterChallengeEligibility } from '../agent/masterChallenge'
import { navigate } from '../lib/router'
import { PageHead, LevelChip, Bar, Remind, Modal } from '../components/ui'

function m(state, id) {
  return state.mastery[id] || 0
}

// 错误码 → 建议重练的案例难度层级（Level 1 观察 / 2 关系 / 3 推理 / 4 反例）
const ERROR_LEVEL = {
  E01: 1, E10: 1, E02: 4, E03: 3, E04: 2, E05: 2, E06: 4, E07: 4, E08: 3, E09: 2,
}

function rechallengeCase(code, state) {
  const level = ERROR_LEVEL[code] || 2
  const done = state.completedCases || {}
  const pool = CASES.filter((c) => c.level === level)
  const fresh = pool.find((c) => !done[c.id])
  const item = fresh || pool[0] || CASES[0]
  return item
}

function daysAgoLabel(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

// V1.6.1：「最近的我」——只看最近 7 次行为的方向变化（全部来自真实数据，不造假）
function recentMe(state) {
  const att = (state.caseAttempts || []).slice(-7)
  if (att.length < 4) return null
  const mid = Math.floor(att.length / 2)
  const front = att.slice(0, mid)
  const back = att.slice(mid)
  const avg = (list, key) =>
    list.length ? Math.round(list.reduce((a, b) => a + ((b.dimensions || {})[key] ?? 50), 0) / list.length) : 50
  const arrow = (a, b) => (b - a >= 5 ? '↑' : a - b >= 5 ? '↓' : '→')
  const rows = [
    { label: '证据意识', v: arrow(avg(front, 'info'), avg(back, 'info')) },
    { label: '反例意识', v: arrow(avg(front, 'counter'), avg(back, 'counter')) },
    { label: '判断边界', v: arrow(avg(front, 'boundary'), avg(back, 'boundary')) },
  ]
  const calib = (list) => {
    const ds = list
      .filter((a) => typeof a.confidence === 'number' && typeof a.actualQuality === 'number')
      .map((a) => Math.abs(a.confidence - a.actualQuality))
    return ds.length ? Math.round(ds.reduce((x, y) => x + y, 0) / ds.length) : null
  }
  const c1 = calib(front)
  const c2 = calib(back)
  if (c1 != null && c2 != null) rows.push({ label: '信心校准', v: arrow(c2, c1) }) // 误差下降 = ↑
  const e01 = (list) => list.filter((a) => (a.errorTypes || []).includes('E01')).length
  const e1 = e01(front)
  const e2 = e01(back)
  rows.push({ label: '过早结论', v: e2 < e1 ? '↓' : e2 > e1 ? '↑' : '→' }) // ↓ = 在减少，是好事
  return rows
}

export function GrowthPage() {
  const { state, dispatch } = useApp()
  const lvl = levelForXp(state.xp)
  const agent = runAgent(state)
  const mp = agent.masteryProfile
  const eligibility = masterChallengeEligibility(mp, state.caseAttempts)
  const errors = topErrors(state.errorPatterns, 5)
  const [showMenu, setShowMenu] = useState(false)

  const lastAt = {}
  ;(state.errorEvents || []).forEach((e) => {
    if (e && e.code) lastAt[e.code] = e.at
  })

  const caseScores = Object.values(state.completedCases || {}).map((c) => c.score)
  const timeline = buildEvolutionTimeline(state.caseAttempts)
  const radar = {
    labels: ['五行理解', '天干地支', '十神', '旺衰', '案例推理', '现实验证'],
    values: [
      Math.round(((m(state, 'five-elements') + m(state, 'generating-restraining')) / 2 / 6) * 100),
      Math.round(((m(state, 'heavenly-stems') + m(state, 'earthly-branches')) / 2 / 6) * 100),
      Math.round((m(state, 'ten-gods') / 6) * 100),
      Math.round((m(state, 'strength') / 6) * 100),
      caseScores.length ? Math.round(caseScores.reduce((a, b) => a + b, 0) / caseScores.length) : 0,
      Math.min(100, Object.values(state.experiments || {}).filter((e) => e?.completed).length * 20),
    ],
  }

  const stats = [
    { num: Object.values(state.mastery || {}).filter((v) => v >= 4).length, lbl: '已掌握知识点' },
    { num: Object.keys(state.completedCases || {}).length, lbl: '完成案例' },
    { num: Object.values(state.experiments || {}).filter((e) => e?.completed).length, lbl: '完成实验' },
    { num: Object.values(state.errorPatterns || {}).reduce((a, b) => a + b, 0), lbl: '错误纠正' },
    { num: state.streak || 0, lbl: '连续学习(天)' },
  ]

  return (
    <div>
      <PageHead title="🧠 我的成长" sub="你会在这里看到：学会了什么、哪里容易错、下一步该学什么。" right={<LevelChip level={lvl.level} name={lvl.name} />} />

      {/* 等级与 XP */}
      <div className="card">
        <div className="spread">
          <div>
            <h1 className="display" style={{ fontSize: 34 }}>Lv.{lvl.level} <span style={{ fontSize: 20, color: 'var(--amber-deep)' }}>{lvl.name}</span></h1>
            <p className="muted tiny mt-8">XP {state.xp} · 距离 {lvl.nextName} 还差一步</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowMenu(true)}>⚙️ 数据管理</button>
        </div>
        <div className="mt-16"><Bar value={lvl.progress} tone="amber" /></div>
        <p className="tiny muted mt-8">XP 来自「学会知识、完成挑战、纠正错误」，而不是打开网站。</p>
      </div>

      {/* V2：学徒档案（8 维能力 + 出师进度） */}
      <div className="card mt-16">
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 4 }}>🧭 我的学徒档案</h3>
            <p className="muted tiny">能力等级来自真实行为，不是做题数量。系统记录你完成案例时用了多少提示、有没有主动找证据。</p>
          </div>
          {mp?.ready && <span className="pill pill-teal">{mp.levelEmoji} {mp.levelName}</span>}
        </div>

        {!mp?.ready ? (
          <div className="feedback warn mt-12">
            <h4>档案还没成形</h4>
            <p className="tiny mt-8">至少完成 3 个案例，系统才能开始评估你的 8 项能力。</p>
          </div>
        ) : (
          <>
            <p className="tiny muted mt-8" style={{ lineHeight: 1.7 }}>{mp.levelDesc}</p>

            <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px' }}>
              {MASTERY_DIMENSIONS.map((d) => {
                const v = mp[d.key] ?? 0
                return (
                  <div key={d.key}>
                    <div className="spread">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{d.label}</span>
                      <span className="tiny muted">{v}</span>
                    </div>
                    <div className="mt-8"><Bar value={v} tone={v < 55 ? 'indigo' : v < 70 ? 'amber' : 'teal'} /></div>
                  </div>
                )
              })}
            </div>

            <div className="tiny muted mt-12">
              提示依赖 {mp.hintDependency}/100 · 知识依赖 {mp.consultedKnowledgeRate}%
              {mp.beliefRevision ? ` · 信念修正：${mp.beliefRevision.label}` : ''}
              {mp.confidenceCalibration != null ? ` · 信心校准：${mp.confidenceCalibration}/100` : ''}
            </div>

            <div className="mt-16" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              {eligibility.ok ? (
                <div className="feedback good mt-8">
                  <h4>🎓 你已达到出师条件</h4>
                  <p className="tiny mt-8">{eligibility.reason}</p>
                  <button className="btn btn-primary mt-12" onClick={() => navigate('/case/case-042')}>开始出师挑战 →</button>
                </div>
              ) : (
                <div className="feedback warn mt-8">
                  <h4>🎓 出师挑战 · 未解锁</h4>
                  <p className="tiny mt-8">{eligibility.reason}</p>
                  {eligibility.gaps.length > 0 && (
                    <div className="row mt-8" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {eligibility.gaps.map((g) => (
                        <span key={g.key} className="pill pill-red">{g.label} {g.value}/{g.need}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* V1.5：玄学思维画像 */}
      <div className="card mt-16">
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 4 }}>🧠 我的玄学思维画像</h3>
            <p className="muted tiny">不是成绩单，而是你的「判断方式」长什么样。</p>
          </div>
          {agent.calibration?.ready && (
            <span className="pill pill-indigo">信心校准：{agent.calibration.verdict}</span>
          )}
        </div>

        <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px' }}>
          {agent.profile.dims.map((d) => {
            const v = agent.profile.values[d.key] ?? 0
            return (
              <div key={d.key}>
                <div className="spread">
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{d.label}</span>
                  <span className="tiny muted">{v}</span>
                </div>
                <div className="mt-8"><Bar value={v} tone={v < 45 ? 'indigo' : 'teal'} /></div>
              </div>
            )
          })}
        </div>
        {!agent.profile.calibrationReady && (
          <p className="tiny muted mt-12">信心校准维度需要完成几个带「信心评分」的案例后才会点亮。</p>
        )}

        <div className="grid-2 mt-16" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <div className="feedback good" style={{ marginTop: 0 }}>
            <h4>↗ 最近发现</h4>
            <p className="tiny mt-8">你最近进步最快的是：<b>{agent.profileHighlights.best.label}</b>（{agent.profileHighlights.best.value} 分）。</p>
          </div>
          <div>
            {agent.profileHighlights.issue ? (
              <div className="feedback warn" style={{ marginTop: 0 }}>
                <h4>↘ 最近的问题</h4>
                <p className="tiny mt-8">你仍然容易：<b>{agent.profileHighlights.issue.label}</b>（{agent.profileHighlights.issue.value} 分）。</p>
              </div>
            ) : (
              <div className="feedback good" style={{ marginTop: 0 }}>
                <h4>✓ 比较均衡</h4>
                <p className="tiny mt-8">各维度没有明显短板，可以尝试更难的多层推理。</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="tiny muted">下一步</div>
            <div style={{ fontWeight: 700 }}>🕵️ {agent.profileNextStep.title}</div>
            <div className="tiny muted mt-4">{agent.profileNextStep.why}</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/cases')}>去练 →</button>
        </div>
      </div>

      {/* V1.6：个人推理指纹 */}
      <div className="card mt-16">
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 4 }}>🖐 我的推理指纹</h3>
            <p className="muted tiny">不是分数，而是系统从你的真实行为里读出的「思维习惯」。它会随你的行为而变。</p>
          </div>
          {agent.fingerprint.ready && <span className="pill pill-indigo">样本 {agent.fingerprint.sampleCount} 次</span>}
        </div>

        {!agent.fingerprint.ready ? (
          <div className="feedback warn mt-12">
            <h4>指纹还没成形</h4>
            <p className="tiny mt-8">{agent.fingerprint.why}</p>
          </div>
        ) : (
          <div className="mt-16">
            <div className="fp-primary">
              <div style={{ fontSize: 32 }}>{agent.fingerprint.primaryPattern.emoji}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{agent.fingerprint.primaryPattern.label}</div>
                <p className="tiny muted mt-4">{agent.fingerprint.primaryPattern.desc}</p>
              </div>
            </div>
            {agent.fingerprint.secondaryPatterns.length > 0 && (
              <p className="tiny muted mt-8">
                次要倾向：{agent.fingerprint.secondaryPatterns.map((p) => `${p.emoji} ${p.label}`).join('、')}
              </p>
            )}

            <div className="grid-2 mt-12" style={{ gap: 12 }}>
              <div className="feedback good" style={{ marginTop: 0 }}>
                <h4>↗ 你的优势</h4>
                {agent.fingerprint.strengths.length ? (
                  <ul className="mini-list">
                    {agent.fingerprint.strengths.map((s) => (
                      <li key={s.key}>{s.label}（{s.value} 分）</li>
                    ))}
                  </ul>
                ) : (
                  <p className="tiny mt-8">暂时没有明显突出的维度，均衡也是一种风格。</p>
                )}
              </div>
              <div className="feedback warn" style={{ marginTop: 0 }}>
                <h4>↘ 你的盲点</h4>
                {agent.fingerprint.blindSpots.length ? (
                  <ul className="mini-list">
                    {agent.fingerprint.blindSpots.map((s) => (
                      <li key={s.key}>{s.label}（{s.value} 分）</li>
                    ))}
                  </ul>
                ) : (
                  <p className="tiny mt-8">没有明显的短板，可以挑战更难的多层推理。</p>
                )}
              </div>
            </div>

            <div className="feedback mt-12" style={{ background: 'rgba(69,84,155,0.08)', borderLeftColor: 'var(--indigo)', marginTop: 12 }}>
              <h4>🔍 系统为什么这样判定？</h4>
              <p className="tiny mt-8">{agent.fingerprint.why}</p>
              {agent.fingerprint.evidence && (
                <div className="row mt-8" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {agent.fingerprint.evidence.caseCount != null && <span className="pill" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo)' }}>最近 {agent.fingerprint.evidence.caseCount} 次案例</span>}
                  {agent.fingerprint.evidence.infoAvg != null && <span className="pill" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo)' }}>找信息 {agent.fingerprint.evidence.infoAvg}</span>}
                  {agent.fingerprint.evidence.overAvg != null && <span className="pill" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo)' }}>证据克制 {agent.fingerprint.evidence.overAvg}</span>}
                  {agent.fingerprint.evidence.counterAvg != null && <span className="pill" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo)' }}>反例意识 {agent.fingerprint.evidence.counterAvg}</span>}
                  {agent.fingerprint.evidence.boundaryAvg != null && <span className="pill" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo)' }}>判断边界 {agent.fingerprint.evidence.boundaryAvg}</span>}
                  {agent.fingerprint.evidence.confAvg != null && <span className="pill" style={{ background: 'rgba(69,84,155,0.1)', color: 'var(--indigo)' }}>平均信心 {agent.fingerprint.evidence.confAvg}</span>}
                </div>
              )}
            </div>

            <div className="spread mt-12" style={{ alignItems: 'flex-start' }}>
              <span className={`pill ${agent.fingerprint.trend.direction === 'declining' ? 'pill-red' : agent.fingerprint.trend.direction === 'improving' ? 'pill-teal' : ''}`}>
                {agent.fingerprint.trend.direction === 'improving' ? '📈' : agent.fingerprint.trend.direction === 'declining' ? '📉' : '➖'} 趋势
              </span>
              <span className="tiny muted" style={{ flex: 1, textAlign: 'right' }}>{agent.fingerprint.trend.desc}</span>
            </div>
            {agent.fingerprint.confidenceCalibration.ready && (
              <p className="tiny muted mt-8">🎯 信心校准：{agent.fingerprint.confidenceCalibration.verdict}（基于 {agent.fingerprint.confidenceCalibration.samples} 次信心记录）</p>
            )}
          </div>
        )}
      </div>

      {/* V1.6：推理进化时间线 */}
      {timeline && (
        <div className="card mt-16">
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>🧠 我的推理是怎么变化的</h3>
          <p className="muted tiny">按时间分阶段，看你的推理方式如何一步步变化。</p>
          <div className="evolve mt-16">
            {timeline.phases.map((p, i) => (
              <div key={i} className="evolve-node">
                <div className="evolve-badge">{p.week}</div>
                <div className="tiny muted mt-4">{p.range}</div>
                <p className="tiny mt-8" style={{ lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
            <div className="evolve-node current">
              <div className="evolve-badge">现在</div>
              {agent.fingerprint.ready ? (
                <p className="tiny mt-8" style={{ lineHeight: 1.7 }}>
                  {agent.fingerprint.primaryPattern.emoji} {agent.fingerprint.primaryPattern.label}——{agent.fingerprint.primaryPattern.desc}
                </p>
              ) : (
                <p className="tiny mt-8" style={{ lineHeight: 1.7 }}>继续积累案例，让系统看清你的模式。</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* V1.6.1：最近的我——行为变化，而不是只看分数 */}
      {recentMe(state) && (
        <div className="card mt-16">
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 4 }}>📈 最近的我</h3>
              <p className="muted tiny">最近 7 次案例里，我发生了什么变化？</p>
            </div>
            <span className="pill pill-teal">样本 {Math.min(7, (state.caseAttempts || []).length)} 次</span>
          </div>
          <div className="mt-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px' }}>
            {recentMe(state).map((r) => (
              <div key={r.label} className="spread" style={{ padding: '10px 14px', background: 'var(--bg-warm)', borderRadius: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: r.v === '↑' ? 'var(--teal-deep)' : r.v === '↓' ? 'var(--indigo)' : 'var(--text-2)' }}>{r.v}</span>
              </div>
            ))}
          </div>
          <p className="tiny muted mt-8">↑ 增强 · → 平稳 · ↓ 减弱（「过早结论」的 ↓ 是好事）。箭头来自最近 7 次前后两半的真实对比，不是估算。</p>
        </div>
      )}

      {/* 能力雷达 */}
      <div className="grid-2 mt-16" style={{ alignItems: 'stretch' }}>
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>📡 能力雷达</h3>
          <RadarChart labels={radar.labels} values={radar.values} />
          <p className="tiny muted center mt-8">雷达是「相对分布」，不是成绩单。短板才是下一步的线索。</p>
        </div>

        {/* 学习统计 */}
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>📊 我的学习统计</h3>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {stats.map((s) => (
              <div key={s.lbl} className="stat-card">
                <div className="num">{s.num}</div>
                <div className="lbl">{s.lbl}</div>
              </div>
            ))}
          </div>

          <h3 className="mt-20" style={{ fontSize: 15 }}>💬 Agent 一句话评价</h3>
          <p className="mt-8" style={{ fontSize: 15 }}>{agent.feedback}</p>
          {agent.nextAction && (
            <button
              className="btn btn-teal mt-16"
              onClick={() => {
                const a = agent.nextAction
                if (a.type === 'lesson') navigate(a.id ? `/lesson/${a.id}` : '/lesson')
                else if (a.type === 'case') navigate(`/case/${a.id}`)
                else if (a.type === 'experiment') navigate(`/lab/${a.id}`)
                else if (a.type === 'exp') navigate(a.id ? `/exp/${a.id}` : '/exp')
                else navigate('/map')
              }}
            >
              下一步：{agent.nextAction.title} →
            </button>
          )}
        </div>
      </div>

      {/* 错误博物馆 */}
      <div className="card mt-16">
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>🏛️ 我的错误博物馆</h3>
        <p className="muted tiny">你曾经踩过的坑——不是丢脸，而是最值钱的教材。</p>
        {errors.length === 0 ? (
          <p className="muted mt-8">博物馆还空着。继续练习，踩过的坑会一件件陈列到这里，供你反复挑战。</p>
        ) : (
          <div className="mt-12">
            {errors.map((e, i) => {
              const cs = rechallengeCase(e.code, state)
              const trend = errorMuseumTrend(state, e.code)
              return (
                <div key={e.code} className="error-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>
                      🪤 坑{String(i + 1).padStart(2, '0')} · {e.name} <span className="pill pill-red">{e.code}</span>
                    </div>
                    <div className="tiny muted mt-4">{e.advice}</div>
                    <div className="tiny muted mt-4">
                      出现 {e.count} 次{lastAt[e.code] ? ` · 最后一次：${daysAgoLabel(lastAt[e.code])}` : ''}
                    </div>
                    {trend.marks.length > 0 && (
                      <div className="tiny mt-4">
                        <span className="muted">最近 3 次：</span>
                        <span style={{ letterSpacing: 4, fontWeight: 700 }}>{trend.marks.join(' ')}</span>
                      </div>
                    )}
                    {trend.trend && (
                      <div className="mt-4">
                        <span className="pill" style={{ background: trend.trend === 'repeating' ? 'rgba(194,91,72,0.12)' : 'rgba(50,143,126,0.12)', color: trend.trend === 'repeating' ? 'var(--danger)' : 'var(--teal-deep)' }}>
                          {trend.emoji} {trend.label}
                        </span>
                      </div>
                    )}
                    {trend.change && (
                      <div className="tiny mt-4" style={{ color: trend.change.improving === false ? 'var(--danger)' : 'var(--teal-deep)' }}>
                        {trend.change.improving === true ? '↗ 改变：' : trend.change.improving === false ? '↘ 改变：' : '➖ 改变：'}{trend.change.text}
                      </div>
                    )}
                  </div>
                  {cs && (
                    <button className="btn btn-sm btn-teal" onClick={() => navigate(`/case/${cs.id}`)}>再挑战一次</button>
                  )}
                </div>
              )
            })}
            <button className="btn btn-primary mt-12" onClick={() => navigate('/cases')}>针对性训练 →</button>
          </div>
        )}
      </div>

      {/* 成就 */}
      <div className="card mt-16">
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>🏆 成就</h3>
        <div className="achievement-grid">
          {ACHIEVEMENTS.map((a) => {
            const got = !!state.achievements[a.id]
            return (
              <div key={a.id} className={`achievement ${got ? '' : 'locked'}`}>
                <div className="a-emoji">{got ? a.emoji : '🔒'}</div>
                <div style={{ fontWeight: 700, marginTop: 8, fontSize: 14 }}>{a.title}</div>
                <div className="tiny muted mt-4">{a.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {showMenu && <DataMenu onClose={() => setShowMenu(false)} />}
    </div>
  )
}

function RadarChart({ labels, values }) {
  const size = 260
  const center = size / 2
  const R = 95
  const n = labels.length

  function pt(i, r) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)]
  }

  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    labels.map((_, i) => pt(i, R * f).join(',')).join(' '),
  )
  const spokes = labels.map((_, i) => {
    const [x, y] = pt(i, R)
    return `${center},${center} ${x},${y}`
  })
  const polygon = values
    .map((v, i) => pt(i, (v / 100) * R).join(','))
    .join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 320, margin: '0 auto', display: 'block' }}>
      {rings.map((r, i) => (
        <polygon key={i} points={r} fill={i === 3 ? 'rgba(217,164,65,0.04)' : 'none'} stroke="rgba(28,26,23,0.1)" strokeWidth="1" />
      ))}
      {spokes.map((s, i) => <line key={i} x1={center} y1={center} x2={s.split(' ')[2]} y2={s.split(' ')[3]} stroke="rgba(28,26,23,0.08)" strokeWidth="1" />)}
      <polygon points={polygon} fill="rgba(50,143,126,0.22)" stroke="var(--teal)" strokeWidth="2" />
      {values.map((v, i) => {
        const [x, y] = pt(i, (v / 100) * R)
        return <circle key={i} cx={x} cy={y} r="3.5" fill="var(--teal-deep)" />
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, R + 18)
        return (
          <text key={i} x={x} y={y} textAnchor="middle" fontSize="11" fill="var(--text-2)">
            {l}
          </text>
        )
      })}
    </svg>
  )
}

function DataMenu({ onClose }) {
  const { state, dispatch } = useApp()
  const fileRef = useRef(null)
  const [confirmReset, setConfirmReset] = useState(false)

  function onImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = importJSON(String(reader.result))
        dispatch({ type: 'IMPORT', state: parsed })
        onClose()
      } catch {
        alert('导入失败：文件格式不正确。')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Modal title="⚙️ 数据管理" onClose={onClose}>
      <p className="muted tiny">你的学习数据只保存在浏览器本地。建议定期导出备份。</p>

      <div className="grid-2 mt-12">
        <button className="btn btn-teal btn-block" onClick={() => downloadJSON(state)}>导出 JSON</button>
        <button className="btn btn-indigo btn-block" onClick={() => fileRef.current?.click()}>导入 JSON</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />

      <div className="mt-16" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        {!confirmReset ? (
          <button className="btn btn-danger btn-block" onClick={() => setConfirmReset(true)}>清空所有数据</button>
        ) : (
          <div>
            <p className="tiny" style={{ color: 'var(--danger)' }}>确定要清空吗？这不可撤销。</p>
            <div className="row mt-12">
              <button className="btn btn-soft btn-block" onClick={() => setConfirmReset(false)}>取消</button>
              <button className="btn btn-danger btn-block" onClick={() => { dispatch({ type: 'RESET' }); onClose() }}>确认清空</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}