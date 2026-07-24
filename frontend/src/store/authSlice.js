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

export const fetchMe = createAsyncThunk('auth/fetchMe', async () => {
  const { data } = await client.get('/me')
  return data.user
})

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: saved.user ?? null,
    token: saved.token ?? null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, { payload }) => {
        state.user = payload.user
        state.token = payload.token
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
      })
      .addCase(fetchMe.fulfilled, (state, { payload }) => {
        state.user = payload
      })
  },
})

// Selectors — the old zustand getters, redux-style.
export const selectUser = (s) => s.auth.user
export const selectIsAuthenticated = (s) => !!s.auth.token
export const selectIsAdmin = (s) => s.auth.user?.role === 'admin'
export const selectIsViewer = (s) => s.auth.user?.role === 'viewer'

export default authSlice.reducer
