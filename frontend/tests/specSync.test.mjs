import test from 'node:test'
import assert from 'node:assert/strict'
import { syncSpecFromFields, computeDimSpec } from '../src/generator/specSync.js'

/* Reported from a live quote: the proposal printed
     RETURNS:
     4"
   instead of `RETURNS: 4"`. Root cause was `\s` after the colon in the RETURNS pattern — it
   matches newlines, so the capture group swallowed the line break and `.*$` then matched the
   FOLLOWING line, writing the depth one line down AND replacing whatever that line said. */

const spec = [
  'SIGN TYPE : NON ILLUMINATED FABRICATED CHANNEL LETTERS',
  'LETTER FACE: SS/ALUMINUM FACE',
  'RETURNS:',
  'MOUNTING: FLUSH/STUD MOUNT',
  'FINISH: SATIN',
].join('\n')

test('an empty RETURNS line takes the depth on its OWN line', () => {
  const out = syncSpecFromFields(spec, { dims: '124 x 20 x 4' })
  assert.match(out, /^RETURNS: 4"$/m)
  assert.doesNotMatch(out, /^RETURNS:[ \t]*$/m)
})

test('the line after RETURNS survives — it is not consumed by the depth', () => {
  const out = syncSpecFromFields(spec, { dims: '124 x 20 x 4' })
  assert.match(out, /^MOUNTING: FLUSH\/STUD MOUNT$/m)
  assert.match(out, /^FINISH: SATIN$/m)
})

test('a RETURNS line that already has a value keeps its suffix', () => {
  const out = syncSpecFromFields('RETURNS: 3" DEEP ALUMINUM\nFINISH: SATIN', { dims: '10 x 10 x 5' })
  assert.match(out, /^RETURNS: 5"$/m)
  assert.match(out, /^FINISH: SATIN$/m)
})

test('LETTER RETURNS is the same line under another name', () => {
  const out = syncSpecFromFields('LETTER RETURNS:\nFINISH: SATIN', { dims: '10 x 10 x 2' })
  assert.match(out, /^LETTER RETURNS: 2"$/m)
  assert.match(out, /^FINISH: SATIN$/m)
})

test('a quote already saved with the split is repaired on the next sync', () => {
  // No depth in the dims here: the repair must run on its own, not only as a side effect of
  // rewriting the line.
  const broken = 'SIGN TYPE : X\nRETURNS:\n4"\nMOUNTING: FLUSH'
  const out = syncSpecFromFields(broken, { dims: '124 x 20' })
  assert.match(out, /^RETURNS: 4"$/m)
  assert.match(out, /^MOUNTING: FLUSH$/m)
})

test('a real spec line is never pulled up into RETURNS', () => {
  const out = syncSpecFromFields('RETURNS:\nMOUNTING: FLUSH', { dims: '124 x 20' })
  assert.match(out, /^MOUNTING: FLUSH$/m)
})

test('computeDimSpec keeps writing the depth on the RETURNS line itself', () => {
  const next = computeDimSpec('h', '6', { dims: '124 x 20 x 4', specText: spec })
  assert.match(next.specText, /^RETURNS: 6"/m)
  assert.match(next.specText, /^MOUNTING: FLUSH\/STUD MOUNT$/m)
})
