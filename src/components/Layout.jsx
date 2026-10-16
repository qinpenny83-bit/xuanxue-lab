// ============================================================
// 顶部导航：品牌 + 主菜单 + 等级/连学徽章。
// ============================================================
import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { levelForXp } from '../game/levels'
import { navigate } from '../lib/router'
import { LevelChip } from './ui'
import { PERSONAS } from '../agent/teacherPersona'

const NAV = [
  { path: '/', label: '首页' },
  { path: '/map', label: '地图' },
  { path: '/memorize', label: '必背' },
  { path: '/hex', label: '卦档' },
  { path: '/terms', label: '术语' },
  { path: '/cases', label: '案例' },
  { path: '/play', label: '易工坊' },
  { path: '/lab', label: '实验' },
  { path: '/tools', label: '工具' },
  { path: '/exp', label: '推理实验' },
  { path: '/doubt', label: '怀疑' },
  { path: '/chart', label: '命盘' },
  { path: '/growth', label: '成长' },
]

function activePath(route) {
  const [name] = route.segments
  if (name === undefined) return '/'
  if (name === 'case' || name === 'cases') return '/cases'
  if (name === 'lesson' || name === 'vertex') return '/lesson'
  if (name === 'lab') return '/lab'
  return `/${name}`
}

export function Header({ route }) {
  const { state, dispatch } = useApp()
  const [searchQ, setSearchQ] = useState('')
  const lvl = levelForXp(state.xp)
  const active = activePath(route)
  const personaId = state.settings?.teacherPersona || 'gentle'

  function submitSearch(e) {
    e.preventDefault()
    const q = searchQ.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}`)
    setSearchQ('')
  }

  return (
    <header className="header">
      <div className="brand" onClick={() => navigate('/')}>
        <div className="brand-mark">🔮</div>
        <div className="brand-name">
          玄学实验室
          <small>别急着算，先学会怎么看</small>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((it) => (
          <a
            key={it.path}
            className={`nav-item ${active === it.path ? 'active' : ''}`}
            href={`#${it.path}`}
          >
            {it.label}
          </a>
        ))}
      </nav>

      <form className="header-search" onSubmit={submitSearch}>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="🔍 全局搜索"
          aria-label="全局搜索"
        />
      </form>

      <div className="header-side">
        {state.streak > 0 && <span className="streak-chip">🔥 {state.streak} 天</span>}
        <select
          className="persona-switch"
          title="切换老师人格"
          value={personaId}
          onChange={(e) => dispatch({ type: 'SET_SETTING', key: 'teacherPersona', value: e.target.value })}
        >
          {Object.values(PERSONAS).map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>
          ))}
        </select>
        <LevelChip level={lvl.level} name={lvl.name} />
      </div>
    </header>
  )
}