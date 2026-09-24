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
const LessonList = lazy(() => import('./pages/Lesson').then((m) => ({ default: m.LessonList })))
const LessonRunner = lazy(() => import('./pages/Lesson').then((m) => ({ default: m.LessonRunner })))
const CasesPage = lazy(() => import('./pages/Cases').then((m) => ({ default: m.CasesPage })))
const CaseRunner = lazy(() => import('./pages/CaseRunner').then((m) => ({ default: m.CaseRunner })))
const LabPage = lazy(() => import('./pages/Lab').then((m) => ({ default: m.LabPage })))
const LabRunner = lazy(() => import('./pages/Lab').then((m) => ({ default: m.LabRunner })))
const ChartPage = lazy(() => import('./pages/Chart').then((m) => ({ default: m.ChartPage })))
const GrowthPage = lazy(() => import('./pages/Growth').then((m) => ({ default: m.GrowthPage })))
const DictionaryPage = lazy(() => import('./pages/Dictionary').then((m) => ({ default: m.DictionaryPage })))
const DoubtLabPage = lazy(() => import('./pages/DoubtLab').then((m) => ({ default: m.DoubtLabPage })))
const WorkshopPage = lazy(() => import('./pages/Workshop').then((m) => ({ default: m.WorkshopPage })))
const HexArchivePage = lazy(() => import('./pages/HexArchive').then((m) => ({ default: m.HexArchivePage })))
const TermsPage = lazy(() => import('./pages/Terms').then((m) => ({ default: m.TermsPage })))
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
    case 'lesson': // 别名，兼容「课堂」入口
    case 'vertex':
      return id ? <LessonRunner key={id} lessonId={id} /> : <LessonList />
    case 'cases':
      return <CasesPage />
    case 'case':
      return id ? <CaseRunner key={id} caseId={id} /> : <CasesPage />
    case 'lab':
      return id ? <LabRunner key={id} id={id} /> : <LabPage />
    case 'chart':
      return <ChartPage />
    case 'growth':
      return <GrowthPage />
    case 'dict':
      return <DictionaryPage selected={params.term} />
    case 'doubt':
      return <DoubtLabPage taskId={params.task} />
    case 'play':
      return <WorkshopPage />
    case 'hex':
      return <HexArchivePage id={id} params={params} />
    case 'terms':
      return <TermsPage id={id} params={params} />
    case 'exp':
      return id ? <ExperimentRunner key={id} id={id} /> : <ExperimentPage />
    case 'exp-archive':
      return <ExperimentArchivePage />
    case 'path':
      return <PathPage />
    case 'challenge':
      return id ? <ChallengePage key={id} chapterId={id} /> : <Home />
    case 'memorize':
      return <MemorizePage />
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
