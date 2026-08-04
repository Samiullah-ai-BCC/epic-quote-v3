import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePaymentLinkKind, paymentTotalsMode } from '../src/generator/paymentDisplay.js'

test('saved payment kind controls the proposal totals layout', () => {
  assert.equal(paymentTotalsMode('full', 2_000), 'full')
  assert.equal(paymentTotalsMode('deposit', 2_000), 'deposit')
  assert.equal(paymentTotalsMode('balance', 2_000), 'balance')
})

test('legacy and invalid kinds preserve the previous amount-based layout', () => {
  assert.equal(paymentTotalsMode(null, 2_000), 'deposit')
  assert.equal(paymentTotalsMode(undefined, 500), 'full')
  assert.equal(paymentTotalsMode('unexpected', 2_000), 'deposit')
  assert.equal(normalizePaymentLinkKind('unexpected'), null)
})
