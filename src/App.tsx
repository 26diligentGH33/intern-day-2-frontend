import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth'
import { LoginPage } from './pages/LoginPage'
import { TodoPage } from './pages/TodoPage'

/** 未登录访问受保护页面时,记下来源地址,登录成功再回去 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="boot-screen" role="status">
        <span className="boot-dot" />
        <p>正在确认登录状态…</p>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

function NotFoundPage() {
  return (
    <div className="state-block state-page">
      <p className="state-title">页面不存在</p>
      <p className="state-desc">地址可能输错了。</p>
      <Link className="btn btn-ghost" to="/">
        返回首页
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TodoPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
