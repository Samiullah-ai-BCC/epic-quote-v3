import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import client from '../api/client'

// Persisted the same way the old zustand store did (localStorage key "auth"),
// so existing sessions survive the redux migration.
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('auth'))?.state ?? {}
  } catch {
    return {}
  }
})()

export const login = createAsyncThunk('auth/login', async ({ username, password }, { rejectWithValue }) => {
  try {
    const { data } = await client.post('/login', { username, password })
    // 2FA: the server answers a correct password with a CHALLENGE, not a token. Store nothing —
    // the reducer must not treat this as a session, or the app would route to the dashboard with
    // no token and immediately 401.
    // `channel` decides what the code screen SAYS — an authenticator user told to check their
    // email, or the reverse, simply cannot finish signing in. `sent_to` is already masked by
    // the server; the full address never crosses the wire.
    if (data.two_factor_required) return { twoFactorRequired: true, challenge: data.challenge, channel: data.channel || 'totp', sentTo: data.sent_to || '' }
    if (data.two_factor_setup_required) return { twoFactorSetupRequired: true, ...data }
    localStorage.setItem('token', data.token)
    return data
  } catch (err) {
    // createAsyncThunk serialises a thrown Error down to {name,message,stack,code}, which drops
    // the client's `apiMisrouted` flag — the login screen would fall back to "Login failed." and
    // hide the deployment fault it is meant to surface. Carry it across as a rejected VALUE,
    // which unwrap() rethrows intact. Axios errors keep their `response` the same way.
    if (err.apiMisrouted) return rejectWithValue({ apiMisrouted: true, message: err.message })
    throw err
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await client.post('/logout')
  } catch {
    /* token may already be dead — local logout still proceeds */
  }
  localStorage.removeItem('token')
})

// Second step of a 2FA sign-in: challenge + code -> a real session.
// Ask for another emailed code. The CHALLENGE is the authorisation — no username is sent, so this
// cannot be used to make the server email somebody else.
export const resendTwoFactorCode = createAsyncThunk('auth/resendTwoFactorCode', async ({ challenge }) => {
  const { data } = await client.post('/two-factor/resend', { challenge })
  return data
})

export const twoFactorChallenge = createAsyncThunk('auth/twoFactorChallenge', async ({ challenge, code }) => {
  const { data } = await client.post('/two-factor/challenge', { challenge, code })
  localStorage.setItem('token', data.token)
  return data
})

export const confirmTwoFactorSetup = createAsyncThunk('auth/confirmTwoFactorSetup', async ({ challenge, code }) => {
  const { data } = await client.post('/two-factor/setup/confirm', { challenge, code })
  localStorage.setItem('token', data.token)
  return data
})

export const fetchMe = createAsyncThunk('auth/fetchMe', async () => {
  const { data } = await client.get('/me')
  return data
})

// ---- Admin "view as" -------------------------------------------------------------------
// The admin's OWN token is parked under a separate key before the swap. Keeping it in localStorage
// (not just in redux) means a page refresh mid-impersonation can still find the way back — losing
// it would strand the admin in the borrowed session with logging out as the only exit.
const ADMIN_TOKEN_KEY = 'impersonator_token'

export const startImpersonation = createAsyncThunk('auth/startImpersonation', async (userId, { getState }) => {
  const { data } = await client.post(`/users/${userId}/impersonate`)
  localStorage.setItem(ADMIN_TOKEN_KEY, getState().auth.token)
  localStorage.setItem('token', data.token)
  return data
})

export const stopImpersonation = createAsyncThunk('auth/stopImpersonation', async () => {
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY)
  try {
    await client.post('/impersonate/stop')   // revoke the borrowed token server-side
  } catch {
    /* already revoked or expired — restoring the admin session still proceeds */
  }
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  if (adminToken) localStorage.setItem('token', adminToken)
  else localStorage.removeItem('token')
  const { data } = await client.get('/me')   // re-read whoever we now are
  return { token: adminToken, user: data.user }
})

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: saved.user ?? null,
    token: saved.token ?? null,
    // who the admin really is while "viewing as" someone; null when not impersonating
    impersonator: saved.impersonator ?? null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, { payload }) => {
        if (payload.twoFactorRequired || payload.twoFactorSetupRequired) return
        state.user = payload.user
        state.token = payload.token
        state.impersonator = null
      })
      .addCase(twoFactorChallenge.fulfilled, (state, { payload }) => {
        state.user = payload.user
        state.token = payload.token
        state.impersonator = null
      })
      .addCase(confirmTwoFactorSetup.fulfilled, (state, { payload }) => {
        state.user = payload.user
        state.token = payload.token
        state.impersonator = null
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.impersonator = null
      })
      .addCase(fetchMe.fulfilled, (state, { payload }) => {
        state.user = payload.user
        // The server is the authority on whether this token is a borrowed one; a refresh
        // rebuilds the banner from it rather than from a client-side flag that can go stale.
        if (!payload.impersonating) state.impersonator = null
      })
      .addCase(startImpersonation.fulfilled, (state, { payload }) => {
        state.impersonator = payload.impersonator
        state.user = payload.user
        state.token = payload.token
      })
      .addCase(stopImpersonation.fulfilled, (state, { payload }) => {
        state.impersonator = null
        state.user = payload.user
        state.token = payload.token
      })
  },
})

// Selectors — the old zustand getters, redux-style.
export const selectUser = (s) => s.auth.user
export const selectIsAuthenticated = (s) => !!s.auth.token
export const selectIsAdmin = (s) => s.auth.user?.role === 'admin'
export const selectIsViewer = (s) => s.auth.user?.role === 'viewer'
// Mirrors User::canApprovePrices() on the server, which is the actual gate — this only decides
// whether the checkbox is offered, so a rep is never shown a control that answers 403.
export const selectCanApprove = (s) => ['admin', 'manager'].includes(s.auth.user?.role)
// Only representatives may hide quotes from their own list — mirrors User::canHideQuotes()
// on the server, which is the actual gate; this one decides whether the button is drawn.
export const selectCanHideQuotes = (s) => s.auth.user?.role === 'sales_rep'
export const selectImpersonator = (s) => s.auth.impersonator

export default authSlice.reducer
