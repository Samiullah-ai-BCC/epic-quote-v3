import client from './client'

export const listUsers = () => client.get('/users').then((r) => r.data)
export const createUser = (payload) => client.post('/users', payload).then((r) => r.data)
export const updateUser = (id, patch) => client.put(`/users/${id}`, patch).then((r) => r.data)
export const deleteUser = (id) => client.delete(`/users/${id}`).then((r) => r.data)
export const changePassword = (id, password) =>
  client.put(`/users/${id}/password`, { password }).then((r) => r.data)
