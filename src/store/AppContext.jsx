import React, { createContext, useContext, useEffect, useReducer, useMemo, useRef } from 'react'
import { loadState, saveState } from '../lib/storage'
import { reducer } from './reducer'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const firstRender = useRef(true)

  useEffect(() => {
    // 首次渲染后开始持久化（避免覆盖初始加载）
    saveState(state)
    firstRender.current = false
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}