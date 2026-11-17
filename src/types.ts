export interface User {
  id: number
  username: string
  display_name: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface Todo {
  id: number
  title: string
  done: boolean
  created_at: string
}
