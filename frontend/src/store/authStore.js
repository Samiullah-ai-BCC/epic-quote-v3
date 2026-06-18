import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (username, password) => {
        const { data } = await client.post('/login', { username, password })
        localStorage.setItem('token', data.token)
        set({ user: data.user, token: data.token })
        return data.user
      },

      logout: async () => {
        try {
          await client.post('/logout')
        } catch (_) {}
        localStorage.removeItem('token')
        set({ user: null, token: null })
      },

      fetchMe: async () => {
        const { data } = await client.get('/me')
        set({ user: data.user })
        return data.user
      },

      isAdmin: () => get().user?.role === 'admin',
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)

export default useAuthStore
