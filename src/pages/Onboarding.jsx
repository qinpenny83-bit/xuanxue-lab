// ============================================================
// 新手引导：第一次进入只问一个问题，据此调整「今日任务」。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'

const OPTIONS = [
  { key: 'complete-beginner', emoji: '🌱', label: '我完全不懂玄学', desc: '从零开始，一步步建立手感。' },
  { key: 'know-a-bit', emoji: '🧩', label: '我懂一点，但不系统', desc: '帮你补全结构，纠正常见误区。' },
  { key: 'seen-bazi', emoji: '🔮', label: '我看过一些八字', desc: '重点练「看结构」，而不是数五行。' },
  { key: 'system-study', emoji: '📚', label: '我想系统学习', desc: '沿着成长地图，按阶段推进。' },
  { key: 'just-fun', emoji: '🎮', label: '我只是想玩玩', desc: '没关系，从最有趣的案例开始。' },
]

export function Onboarding() {
  const { dispatch } = useApp()
  const [picked, setPicked] = useState(null)

  function start() {
    dispatch({ type: 'ONBOARD', entryReason: picked.key })
  }

  return (
    <div className="onboard">
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ fontSize: 56 }}>🔮</div>
        <h1 className="display" style={{ fontSize: 32, marginTop: 12 }}>玄学实验室</h1>
        <p className="muted" style={{ marginTop: 6 }}>别急着算，先学会怎么看。</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 19 }}>你为什么来到这里？</h2>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          这不是算命，而是一套学习方法。选一个最接近你的，我会据此安排你的第一天。
        </p>
        <div className="onboard-options">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`onboard-option ${picked === o.key ? 'picked' : ''}`}
              style={picked === o.key ? { borderColor: 'var(--amber)' } : {}}
              onClick={() => setPicked(o.key)}
            >
              <b>{o.emoji} {o.label}</b>
              <span>{o.desc}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-block btn-lg mt-20" disabled={!picked} onClick={start}>
          开始我的学习
        </button>
        <p className="tiny muted center mt-12">
          所有数据只保存在你的浏览器本地，全程无需联网。
        </p>
      </div>
    </div>
  )
}