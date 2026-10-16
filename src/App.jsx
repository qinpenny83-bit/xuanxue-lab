// ============================================================
// 玄学实验室 · 应用入口与轻量 Hash 路由（无第三方路由依赖）。
// 页面：首页 / 学习地图 / 课堂 / 案例 / 实验室 / 命盘 / 成长 / 词典。
// 性能：非首页页面全部 React.lazy 按需加载，首屏只加载首页 + 公共壳。
// ============================================================
import React, { Suspense, lazy, useEffect, useState } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { Header } from './components/Layout'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'

// 按需加载：进入对应路由时才下载该页面及其数据（含课程/卦档/术语等大模块）
const MapPage = lazy(() => import('./pages/Map').then((m) => ({ default: m.MapPage })))
const LessonRunner = lazy(() => import('./pages/Lesson').then((m) => ({ default: m.LessonRunner })))
const CasesPage = lazy(() => import('./pages/Cases').then((m) => ({ default: m.CasesPage })))
const CaseRunner = lazy(() => import('./pages/CaseRunner').then((m) => ({ default: m.CaseRunner })))
const LabPage = lazy(() => import('./pages/Lab').then((m) => ({ default: m.LabPage })))
const LabRunner = lazy(() => import('./pages/Lab').then((m) => ({ default: m.LabRunner })))
const GrowthPage = lazy(() => import('./pages/Growth').then((m) => ({ default: m.GrowthPage })))
// 注意：HexArchive/Terms 两个页面是「默认导出」，lazy 需取 m.default，
// 若写成 m.xxx 会解析成 undefined 导致「Element type is invalid」白屏错误
const HexArchivePage = lazy(() => import('./pages/HexArchive').then((m) => ({ default: m.default })))
const TermsPage = lazy(() => import('./pages/Terms').then((m) => ({ default: m.default })))
const ExperimentPage = lazy(() => import('./pages/ExperimentRunner').then((m) => ({ default: m.ExperimentPage })))
const ExperimentRunner = lazy(() => import('./pages/ExperimentRunner').then((m) => ({ default: m.ExperimentRunner })))
const ExperimentArchivePage = lazy(() => import('./pages/ExperimentArchive').then((m) => ({ default: m.ExperimentArchivePage })))
const ToolsPage = lazy(() => import('./pages/Tools').then((m) => ({ default: m.ToolsPage })))
const ResearchPage = lazy(() => import('./pages/Research').then((m) => ({ default: m.ResearchPage })))
const SynthesisWorkshop = lazy(() => import('./pages/Research').then((m) => ({ default: m.SynthesisWorkshop })))
const TransferChallenge = lazy(() => import('./pages/Research').then((m) => ({ default: m.TransferChallenge })))
const ResearchMode = lazy(() => import('./pages/Research').then((m) => ({ default: m.ResearchMode })))
const MasterChallenge = lazy(() => import('./pages/Research').then((m) => ({ default: m.MasterChallenge })))
const PathPage = lazy(() => import('./pages/Path').then((m) => ({ default: m.PathPage })))
const ChallengePage = lazy(() => import('./pages/Challenge').then((m) => ({ default: m.ChallengePage })))
const MemorizePage = lazy(() => import('./pages/Memorize').then((m) => ({ default: m.MemorizePage })))
const SearchPage = lazy(() => import('./pages/Search').then((m) => ({ default: m.SearchPage })))

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, query] = raw.split('?')
  const segs = path.split('/').filter(Boolean)
  const params = {}
  if (query) {
    query.split('&').forEach((kv) => {
      const [k, v] = kv.split('=')
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '')
    })
  }
  return { segments: segs, params }
}

const Loading = () => (
  <div style={{ padding: '48px 0', textAlign: 'center', color: '#888', fontSize: 14 }}>
    ⏳ 加载中…
  </div>
)

function Router({ children, route }) {
  const { state } = useApp()
  const { segments, params } = route
  const [name, id] = segments

  if (!state.onboarded) return <Onboarding />

  switch (name) {
    case undefined:
      return <Home />
    case 'map':
      return <MapPage />
    case 'lesson': // 兼容旧链接：无课程 id 时回到学习地图
    case 'vertex':
      return id ? <LessonRunner key={id} lessonId={id} /> : <MapPage />
    case 'cases':
      return <CasesPage />
    case 'case':
      return id ? <CaseRunner key={id} caseId={id} /> : <CasesPage />
    case 'lab':
      return id ? <LabRunner key={id} id={id} /> : <LabPage />
    case 'chart': // 命盘已并入工具实验室（八字排盘+易经起卦），旧链接兼容
      return <ToolsPage initialTab="chart" />
    case 'growth':
      return <GrowthPage />
    case 'dict': // 词典已并入术语百科（命理入门），旧链接兼容
      return <TermsPage id="dict" params={params} />
    case 'doubt': // 怀疑室已并入推理实验，旧链接兼容
      return <ExperimentPage doubtTask={params.task} />
    case 'play': // 易工坊已并入卦档（实战工作台），旧链接兼容
      return <HexArchivePage id="workshop" />
    case 'hex':
      return <HexArchivePage id={id} params={params} />
    case 'terms':
      return <TermsPage id={id} params={params} />
    case 'exp':
      return id ? <ExperimentRunner key={id} id={id} /> : <ExperimentPage doubtTask={params.task} />
    case 'exp-archive':
      return <ExperimentArchivePage />
    case 'path':
      return <PathPage />
    case 'challenge':
      return id ? <ChallengePage key={id} chapterId={id} /> : <Home />
    case 'memorize':
      return <MemorizePage />
    case 'search':
      return <SearchPage initialQ={params.q} />
    case 'tools':
      return <ToolsPage />
    case 'research': {
      if (!id) return <ResearchPage />
      switch (id) {
        case 'synthesis': return <SynthesisWorkshop />
        case 'transfer': return <TransferChallenge />
        case 'research': return <ResearchMode />
        case 'master': return <MasterChallenge />
        default: return <ResearchPage />
      }
    }
    default:
      return <Home />
  }
}

function Shell() {
  const [route, setRoute] = useState(() => parseHash())
  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const { state } = useApp()

  return (
    <div className="app">
      {state.onboarded && <Header route={route} />}
      <main className="main">
        <Suspense fallback={<Loading />}>
          <Router route={route} />
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
