/**
 * 登录状态管理。
 *
 * 设计要点(和 README 的"登录状态方案"一节对应):
 * 1. 凭证存在 localStorage,请求时放进 Authorization 头。
 * 2. 刷新页面时不会因为"本地有 token"就直接认为已登录 ——
 *    必须调一次 /auth/me 让后端确认,确认前状态是 checking。
 * 3. 任何接口返回 401,统一清空本地状态,由路由把用户送回登录页。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, request } from './api'
import type { LoginResponse, User } from './types'

const TOKEN_STORAGE_KEY = 'intern-day-2.token'

/** checking:正在向后端确认凭证 | anonymous:未登录 | authenticated:已登录 */
export type AuthStatus = 'checking' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  token: string | null
  /** 会话失效后带过来的提示,登录页展示一次然后清掉 */
  notice: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    // 隐私模式下 localStorage 可能不可用,降级为不记住登录
    return null
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* 存不进去也不影响当前会话 */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // 组件卸载后不再 setState,避免 React 警告
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearSession = useCallback((message: string | null) => {
    writeStoredToken(null)
    if (!mountedRef.current) return
    setToken(null)
    setUser(null)
    setStatus('anonymous')
    if (message) setNotice(message)
  }, [])

  // 首次挂载:有本地凭证就拿去问后端"这还算登录吗"
  useEffect(() => {
    const stored = readStoredToken()
    if (!stored) {
      setStatus('anonymous')
      return
    }

    const controller = new AbortController()
    request<User>('/auth/me', { token: stored, signal: controller.signal })
      .then((me) => {
        if (!mountedRef.current) return
        setToken(stored)
        setUser(me)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // 401 说明凭证过期或已退出;网络错误也按未登录处理,但换一句提示
        if (error instanceof ApiError && error.status === 401) {
          clearSession('登录状态已失效，请重新登录')
        } else {
          clearSession(null)
        }
      })

    return () => controller.abort()
  }, [clearSession])

  const login = useCallback(async (username: string, password: string) => {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })

    // 拿到凭证后立刻换用户信息,确保页面展示的是后端数据而不是表单里输入的值
    const me = await request<User>('/auth/me', { token: result.access_token })

    writeStoredToken(result.access_token)
    if (!mountedRef.current) return
    setToken(result.access_token)
    setUser(me)
    setNotice(null)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    const current = token
    // 先请求后端注销凭证,再清本地;后端失败也要清本地,否则用户会卡在登录态
    if (current) {
      try {
        await request<{ detail: string }>('/auth/logout', { method: 'POST', token: current })
      } catch {
        /* 忽略:本地清理更重要 */
      }
    }
    clearSession(null)
  }, [token, clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      notice,
      login,
      logout,
      clearNotice: () => setNotice(null),
    }),
    [status, user, token, notice, login, logout],
  )

  // 把 401 的处理挂到全局:任何页面接口失效都能回到登录页
  useEffect(() => {
    if (status !== 'authenticated') return
    const handler = () => clearSession('登录状态已失效，请重新登录')
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [status, clearSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内部使用')
  return context
}
