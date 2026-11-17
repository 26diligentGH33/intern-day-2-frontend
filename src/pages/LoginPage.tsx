import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { login, notice, clearNotice, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = (location.state as LocationState | null)?.from ?? '/'
  const banner = error ?? notice

  // 已登录状态下直接访问 /login,回到功能页
  useEffect(() => {
    if (status === 'authenticated') navigate(redirectTo, { replace: true })
  }, [status, navigate, redirectTo])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    clearNotice()
    setError(null)

    // 基础校验放在提交时做,避免用户还没输入就报错
    if (!username.trim() || !password) {
      setError('请输入账号和密码')
      return
    }

    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <header className="login-head">
          <span className="login-badge">Intern Day 2</span>
          <h1>待办清单</h1>
          <p className="login-sub">登录后管理你的待办事项。账号由后端初始化脚本创建。</p>
        </header>

        {banner ? (
          <p className="alert alert-error" role="alert">
            {banner}
          </p>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="field-label">账号</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="例如 alice"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={submitting}
            />
          </label>

          <label className="field">
            <span className="field-label">密码</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>

        <footer className="login-foot">
          <p>
            练习账号：<code>alice</code> / <code>Passw0rd!2027</code>
          </p>
          <p className="muted">凭证由后端签发，前端不保存密码。</p>
        </footer>
      </section>
    </main>
  )
}
