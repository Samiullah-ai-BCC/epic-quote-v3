import client from './client'

export const getConstants = () => client.get('/constants').then((r) => r.data)
export const getDashboard = () => client.get('/dashboard').then((r) => r.data)
export const getSalesReps = () => client.get('/reports/sales-reps').then((r) => r.data)
export const getActivity = (params = {}) => client.get('/activity', { params }).then((r) => r.data)

// The company's wire-transfer details, printed on proposals as the alternative to the Shopify pay
// button. Readable by anyone who can open a quote (the proposal has to render them); writable by
// admins only, which the server enforces — the UI merely hides the fields.
export const getBankDetails = () => client.get('/settings/bank').then((r) => r.data.bank)
export const setBankDetails = (bank) => client.put('/settings/bank', { bank }).then((r) => r.data.bank)

export const getLogo = () => client.get('/settings/logo').then((r) => r.data)
export const setLogo = (file) => {
  const fd = new FormData(); fd.append('file', file)
  return client.post('/settings/logo', fd).then((r) => r.data)
}
