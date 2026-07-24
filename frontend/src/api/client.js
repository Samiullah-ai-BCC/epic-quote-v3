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
// A MISROUTED API IS NOT A BAD PASSWORD. On a static host the SPA's catch-all rewrite
// (`/* → /index.html`) also swallows `/api/*` unless the build points at the API's absolute
// URL, so every call quietly returns index.html with a 200. Axios then hands the component an
// HTML string where a token should be, and the login screen reports "Login failed." — sending
// everyone hunting for a database or credential fault that does not exist.
//
// A JSON endpoint answering with HTML is always a deployment fault, never a user one. Say so.
const looksLikeHtml = (d) => typeof d === 'string' && /^\s*<(?:!doctype|html)/i.test(d)
client.interceptors.response.use(
  (res) => {
    if (looksLikeHtml(res.data)) {
      const where = import.meta.env.VITE_API_URL || window.location.origin
      const e = new Error(
        `The API at ${where}/api returned the web page instead of data — the app is built ` +
        'without VITE_API_URL, so API calls are being answered by the site itself. ' +
        'Set VITE_API_URL to the backend URL and redeploy.'
      )
      e.apiMisrouted = true
      return Promise.reject(e)
    }
    return res
  },
  (err) => Promise.reject(err)
)

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
