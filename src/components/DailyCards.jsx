// ============================================================
// 🗓️ 每日一卦 / 每日一练（P1-4 留存钩子）
// 思路：与每日谜题一致，用日期做确定性种子，每天稳定给一个卦 + 一条必背卡。
// 每日一卦：引导进卦档深度阅读（当周深挖入口）。
// 每日一练：把必背条目做成「今天过目一眼」的轻任务，记住即进入间隔复习队列。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { navigate } from '../lib/router'
import { dailyHexagram, dailyMemoItem } from '../data/daily'

// —— 每日一卦：日期种子选一卦，入口进卦档 ——
export function DailyHexagramCard() {
  const hex = dailyHexagram()
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="spread">
          <div style={{ color: 'var(--amber-deep)', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>☯️ 今日一卦</div>
          <span className="pill" style={{ background: 'var(--bg-warm, #f0ece4)', color: '#6e675c' }}>第 {hex.seq} 卦</span>
        </div>
        <h2 className="mt-8" style={{ fontSize: 22, marginBottom: 2 }}>
          <span style={{ fontFamily: 'var(--font-display, serif)' }}>{hex.name}</span>
          <span className="tiny muted" style={{ marginLeft: 8 }}>{hex.full}</span>
        </h2>
        <p className="tiny muted mt-8" style={{ lineHeight: 1.7, minHeight: 44 }}>{hex.plain}</p>
        <div className="tiny mt-8" style={{ color: 'var(--teal-deep, #0f7b6c)', fontWeight: 600 }}>「{hex.imagery}」</div>
      </div>
      <div className="row mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/hex/${hex.seq}`)}>
          开始读这卦 →
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/hex')}>随便翻一卦 🎲</button>
      </div>
    </section>
  )
}

// —— 每日一练：今天过目一条必背卡（记住即进间隔复习） ——
export function DailyPracticeCard() {
  const { state, dispatch } = useApp()
  const item = dailyMemoItem()
  const memorized = (state.memorized || []).includes(item.id)
  const [flipped, setFlipped] = useState(false)

  function mark() {
    if (!memorized) dispatch({ type: 'TOGGLE_MEMORIZE', itemId: item.id })
  }

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="spread">
          <div style={{ color: 'var(--indigo-deep)', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>✍️ 今日一练</div>
          <span className="pill pill-indigo">过目一眼</span>
        </div>
        <div className="mt-8" style={{ fontSize: 18, fontWeight: 800, minHeight: 30 }}>{item.front}</div>
        {flipped ? (
          <div className="mt-8" style={{ fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ color: 'var(--teal-deep, #0f7b6c)', fontWeight: 600 }}>{item.back}</div>
            {item.tip && <div className="tiny mt-4" style={{ color: '#6e675c' }}>💡 {item.tip}</div>}
          </div>
        ) : (
          <div className="tiny muted mt-8" style={{ minHeight: 18 }}>先默想一下，再翻牌对照。</div>
        )}
      </div>
      <div className="row mt-12" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setFlipped((v) => !v)}>
          {flipped ? '收起答案 ▲' : '翻牌看答案 👁️'}
        </button>
        {memorized ? (
          <span className="pill" style={{ background: 'rgba(50,143,126,0.12)', color: 'var(--teal-deep, #0f7b6c)' }}>✓ 已记住</span>
        ) : (
          <button className="btn btn-soft btn-sm" onClick={mark}>记住了</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/memorize')}>去必背表 →</button>
      </div>
    </section>
  )
}
