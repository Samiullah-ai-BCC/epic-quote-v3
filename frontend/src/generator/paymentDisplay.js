export const PAYMENT_LINK_KINDS = ['full', 'deposit', 'balance']

export function normalizePaymentLinkKind(kind) {
  return PAYMENT_LINK_KINDS.includes(kind) ? kind : null
}

// Legacy quotes did not store a payment kind. Preserve their existing totals layout: split rows
// above $500, subtotal-only at or below $500. Once a kind is saved, it is the display authority.
export function paymentTotalsMode(kind, amount) {
  const normalized = normalizePaymentLinkKind(kind)
  if (normalized) return normalized
  return Number(amount) > 500 ? 'deposit' : 'full'
}
