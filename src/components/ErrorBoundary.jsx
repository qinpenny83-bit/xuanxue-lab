import React from 'react'

// 全局错误边界：任何页面渲染异常都降级为错误页（含诊断信息），绝不白屏
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[App] 渲染错误（已降级）', error, info)
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error)
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌫️</div>
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>页面出了点问题</h1>
          <p style={{ color: '#8a8378', lineHeight: 1.8, fontSize: 14 }}>
            学习进度没有丢失，刷新即可恢复。如果仍然异常，请把下面的错误文字发给我们排查。
          </p>
          <p style={{ color: '#c07a5a', fontSize: 13, margin: '12px 0 16px', wordBreak: 'break-all' }}>诊断信息：{msg}</p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            重试 ↻
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
