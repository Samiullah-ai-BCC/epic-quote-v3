import axios from 'axios'

const client = axios.create({
  // Local dev: VITE_API_URL unset → '/api' (Vite proxy). Render: full backend URL.
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear BOTH token stores — the raw token AND the persisted auth store — or the
// app rehydrates as "still authenticated", bounces back to the dashboard, 401s again, and
// loops forever (~every 0.5s). Guard so simultaneous 401s only redirect once, and never
// redirect if we're already on the login page.
let redirecting = false
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !redirecting) {
      redirecting = true
      localStorage.removeItem('token')   // raw token (request interceptor)
      localStorage.removeItem('auth')    // zustand-persisted { token, user } — MUST clear too
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Absolute URL for backend-served files. Dev: VITE_API_URL unset → relative (Vite proxies /storage).
// Prod (split domains): prefixes the backend origin so /storage doesn't hit the static frontend → 404.
export const fileUrl = (p) =>
  p && typeof p === 'string' && p.startsWith('/storage')
    ? (import.meta.env.VITE_API_URL || '') + p
    : p

export default client
