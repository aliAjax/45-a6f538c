const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  blockedTasks?: Array<{ id: number; content: string; uncompletedPrereqCount: number }>
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  responseData: Record<string, unknown>

  constructor(message: string, status: number, responseData: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.responseData = responseData
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = (await response.json()) as ApiResponse<T>

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error || '请求失败',
      response.status,
      data as unknown as Record<string, unknown>
    )
  }

  return data.data
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}

export default api
