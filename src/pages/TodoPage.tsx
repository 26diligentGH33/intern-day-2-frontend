import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, request } from '../api'
import { useAuth } from '../auth'
import type { Todo } from '../types'

export function TodoPage() {
  const { user, token, logout } = useAuth()

  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [pendingIds, setPendingIds] = useState<number[]>([])
  const [creating, setCreating] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadTodos = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await request<Todo[]>('/todos', { token, signal })
        if (!mountedRef.current) return
        setTodos(data)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // 401 交给全局处理(会跳回登录页),这里不再重复提示
        if (error instanceof ApiError && error.status === 401) return
        if (!mountedRef.current) return
        setLoadError(error instanceof Error ? error.message : '加载失败')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadTodos(controller.signal)
    return () => controller.abort()
  }, [loadTodos])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || creating) return

    setCreating(true)
    setActionError(null)
    try {
      const created = await request<Todo>('/todos', {
        method: 'POST',
        body: { title: trimmed },
        token,
      })
      if (!mountedRef.current) return
      // 新待办做完在最上面,和后端排序规则保持一致
      setTodos((prev) => [created, ...prev])
      setTitle('')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return
      if (mountedRef.current) {
        setActionError(error instanceof Error ? error.message : '新增失败')
      }
    } finally {
      if (mountedRef.current) setCreating(false)
    }
  }

  async function handleToggle(todo: Todo) {
    if (pendingIds.includes(todo.id)) return

    setPendingIds((prev) => [...prev, todo.id])
    setActionError(null)
    try {
      const updated = await request<Todo>(`/todos/${todo.id}`, {
        method: 'PATCH',
        body: { done: !todo.done },
        token,
      })
      if (!mountedRef.current) return
      setTodos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return
      if (mountedRef.current) {
        setActionError(error instanceof Error ? error.message : '更新失败')
      }
    } finally {
      if (mountedRef.current) setPendingIds((prev) => prev.filter((id) => id !== todo.id))
    }
  }

  async function handleDelete(todo: Todo) {
    if (pendingIds.includes(todo.id)) return

    setPendingIds((prev) => [...prev, todo.id])
    setActionError(null)
    try {
      await request<{ detail: string }>(`/todos/${todo.id}`, { method: 'DELETE', token })
      if (!mountedRef.current) return
      setTodos((prev) => prev.filter((item) => item.id !== todo.id))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return
      if (mountedRef.current) {
        setActionError(error instanceof Error ? error.message : '删除失败')
      }
    } finally {
      if (mountedRef.current) setPendingIds((prev) => prev.filter((id) => id !== todo.id))
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      if (mountedRef.current) setLoggingOut(false)
    }
  }

  const remaining = todos.filter((item) => !item.done).length

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-eyebrow">待办清单</p>
          <h1>
            你好，{user?.display_name ?? user?.username}
            <span className="app-account">@{user?.username}</span>
          </h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? '退出中…' : '退出登录'}
        </button>
      </header>

      <section className="panel">
        <form className="todo-form" onSubmit={handleCreate}>
          <input
            type="text"
            name="title"
            maxLength={120}
            placeholder="今天要做什么？"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={creating}
          />
          <button type="submit" className="btn btn-primary" disabled={creating || !title.trim()}>
            {creating ? '添加中…' : '添加'}
          </button>
        </form>

        {actionError ? (
          <p className="alert alert-error" role="alert">
            {actionError}
          </p>
        ) : null}

        {loading ? (
          <ul className="todo-list" aria-busy="true">
            {[0, 1, 2].map((key) => (
              <li key={key} className="todo-item skeleton" aria-hidden="true">
                <span className="skeleton-box" />
                <span className="skeleton-line" />
              </li>
            ))}
            <li className="visually-hidden">正在加载待办…</li>
          </ul>
        ) : loadError ? (
          <div className="state-block">
            <p className="state-title">加载失败</p>
            <p className="state-desc">{loadError}</p>
            <button type="button" className="btn btn-ghost" onClick={() => void loadTodos()}>
              重试
            </button>
          </div>
        ) : todos.length === 0 ? (
          <div className="state-block">
            <p className="state-title">还没有待办</p>
            <p className="state-desc">在上面输入一件要做的事，按回车就能加进来。</p>
          </div>
        ) : (
          <>
            <p className="todo-summary">
              共 {todos.length} 条，还有 {remaining} 条未完成
            </p>
            <ul className="todo-list">
              {todos.map((todo) => {
                const pending = pendingIds.includes(todo.id)
                return (
                  <li key={todo.id} className={todo.done ? 'todo-item is-done' : 'todo-item'}>
                    <label className="todo-check">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => void handleToggle(todo)}
                        disabled={pending}
                      />
                      <span className="todo-title">{todo.title}</span>
                    </label>
                    <button
                      type="button"
                      className="todo-delete"
                      onClick={() => void handleDelete(todo)}
                      disabled={pending}
                      aria-label={`删除待办：${todo.title}`}
                    >
                      删除
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <footer className="app-foot">
        <span>数据保存在后端 SQLite，刷新页面会重新向后端校验登录状态。</span>
      </footer>
    </div>
  )
}
