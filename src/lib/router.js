// 轻量 Hash 路由辅助（无第三方依赖）。
export function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`
}