import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin } = useAuthStore()

  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (requireAdmin && !isAdmin()) return <Navigate to="/dashboard" replace />

  return children
}
