import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
})

// Mirror auth into localStorage under the same "auth" key the app has always used.
store.subscribe(() => {
  const { user, token } = store.getState().auth
  localStorage.setItem('auth', JSON.stringify({ state: { user, token } }))
})
