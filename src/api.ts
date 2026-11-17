/**
 * 后端接口封装。
 *
 * 只做三件事:拼地址、带凭证、把 HTTP 错误翻译成中文提示。
 * 业务逻辑不要写在这里,组件才能保持干净。
 */

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** 结尾斜杠会导致 /todos 变成 //todos,统一去掉 */
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '')

export class ApiError extends Error {
  /** 0 表示请求根本没发出去(网络断了、后端没启动) */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: '请求参数不正确',
  401: '登录状态已失效，请重新登录',
  404: '请求的数据不存在',
  422: '提交的内容不符合要求',
  500: '服务端出错了，请稍后再试',
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** FastAPI 的校验错误是数组,这里取第一条拼成人话 */
function extractDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const detail = (payload as { detail?: unknown }).detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: (string | number)[] }
    const field = Array.isArray(first.loc) ? first.loc.filter((part) => part !== 'body').pop() : null
    const message = first.msg?.replace(/^Value error,\s*/, '') ?? '提交的内容不符合要求'
    return field ? `${String(field)}：${message}` : message
  }

  return null
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('无法连接后端服务，请确认后端已启动后重试', 0)
  }

  const text = await response.text()
  const payload = text ? parseJson(text) : null

  if (!response.ok) {
    // 凭证失效的全局信号:登录接口自己会展示"账号或密码错误",不在此列
    if (response.status === 401 && path !== '/auth/login') {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    throw new ApiError(
      extractDetail(payload) ?? DEFAULT_MESSAGES[response.status] ?? `请求失败（HTTP ${response.status}）`,
      response.status,
    )
  }

  return payload as T
}
