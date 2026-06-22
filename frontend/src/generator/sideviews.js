/* Side-view construction diagrams. Keys mirror the PNG filenames in
   backend storage/app/public/side_views/ (served at /storage/side_views/<key>.png). */

export const SIDE_VIEWS = [
  { key: 'face-lit', label: 'FACE LIT' },
  { key: 'face-lit-raceway', label: 'FACE LIT WITH RACEWAY' },
  { key: 'face-lit-2in-backer', label: 'FACE LIT WITH 2IN DEEP ALUMINUM BACKER' },
  { key: 'face-lit-ac-backer', label: 'FACE LIT WITH AC BACKER' },
  { key: 'halo-lit-exposed-acrylic', label: 'HALO LIT (EXPOSED ACRYLIC)' },
  { key: 'halo-lit-inserted-acrylic', label: 'HALO LIT (INSERTED ACRYLIC)' },
  { key: 'halo-lit-2in-backer', label: 'HALO LIT WITH 2IN DEEP ALUMINUM BACKER' },
  { key: 'halo-lit-acm-backer', label: 'HALO LIT WITH ACM BACKER' },
  { key: 'halo-exposed-raceway', label: 'HALO LIT (EXPOSED) WITH RACEWAY' },
  { key: 'halo-traditional-raceway', label: 'HALO LIT TRADITIONAL WITH RACEWAY' },
  { key: 'front-and-side-lit', label: 'FRONT AND SIDE LIT' },
  { key: 'front-side-lit-raceway', label: 'FRONT & SIDE LIT WITH RACEWAY' },
  { key: 'front-side-lit-flat-backer', label: 'FRONT & SIDE LIT WITH FLAT ALUMINUM BACKER' },
  { key: 'front-side-lit-al-cabinet', label: 'FRONT & SIDE LIT WITH ALUMINUM BACKER CABINET' },
  { key: 'push-thru-halo-back', label: 'PUSH THRU WITH HALO BACK' },
  { key: 'push-thru-cabinet-halo', label: 'PUSH THRU CABINET WITH HALO LIT BACK' },
  { key: 'routed-backed-halo-back', label: 'ROUTED & BACKED UP ACRYLIC WITH HALO BACK' },
  { key: 'single-sided-cabinet', label: 'SINGLE SIDED CABINET' },
  { key: 'double-sided-cabinet', label: 'DOUBLE SIDED CABINET' },
  { key: 'trimless-face-lit-flush', label: 'TRIMLESS FACE LIT FLUSH MOUNT' },
  { key: 'trimless-face-lit-backer', label: 'TRIMLESS FACE LIT WITH BACKER' },
  { key: 'trimless-face-lit-raceway', label: 'TRIMLESS FACE LIT WITH RACEWAY' },
  { key: 'fabricated-acrylic-face', label: 'FABRICATED LETTERS — ACRYLIC FACE' },
  { key: 'metal-fab-stud', label: 'METAL FABRICATED — STUD MOUNT' },
  { key: 'metal-fab-acm-backer', label: 'METAL FABRICATED WITH ACM BACKER' },
  { key: 'metal-fab-raceway', label: 'METAL FABRICATED WITH RACEWAY' },
  { key: 'face-halo-lit-al-backer-raceway', label: 'FACE & HALO LIT — ALUMINUM BACKER & RACEWAY' },
]

// Deterministic prior: catalog sign-type name → most likely side-view key.
export const SIGN_TO_SIDEVIEW = {
  'FACE LIT CHANNEL LETTERS': 'face-lit',
  'FACE LIT CHANNEL LETTERS WITH RACEWAY': 'face-lit-raceway',
  'FACE LIT CHANNEL LETTERS WITH BACKER': 'face-lit-2in-backer',
  'FACE LIT CHANNEL LETTERS WITH ACM BACKER': 'face-lit-ac-backer',
  'HALO LIT CHANNEL LETTERS': 'halo-lit-exposed-acrylic',
  'HALO LIT CHANNEL LETTERS WITH RACEWAY': 'halo-traditional-raceway',
  'HALO LIT CHANNEL LETTERS WITH BACKER': 'halo-lit-2in-backer',
  'HALO LIT CHANNEL LETTERS WITH ACM BACKER': 'halo-lit-acm-backer',
  'FACE AND HALO LIT CHANNEL LETTERS': 'front-and-side-lit',
  'FACE & HALO LIT CHANNEL LETTERS WITH BACKER': 'front-side-lit-flat-backer',
  'FACE & HALO LIT CHANNEL LETTERS WITH ACM BACKER & RACEWAY': 'face-halo-lit-al-backer-raceway',
  'FACE & HALO LIT CHANNEL LETTERS ON FLAT ALUMINUM BACKER & RACEWAY': 'front-side-lit-raceway',
  'FACE & HALO LIT CABINET': 'front-side-lit-al-cabinet',
  'PUSH THRU ILLUMINATED CABINET (SINGLE SIDED)': 'single-sided-cabinet',
  'PUSH THRU ILLUMINATED CABINET WITH HALO LIT BACK': 'push-thru-cabinet-halo',
  'DOUBLE SIDED PUSH THRU ILLUMINATED CABINET': 'double-sided-cabinet',
  'SINGLE SIDED ILLUMINATED CABINET': 'single-sided-cabinet',
  'DOUBLE SIDED ILLUMINATED CABINET': 'double-sided-cabinet',
  'SINGLE SIDED ROUTED & BACKED UP ACRYLIC CABINET': 'routed-backed-halo-back',
}

const KEYS = new Set(SIDE_VIEWS.map((s) => s.key))

// Fuse the deterministic prior with the Groq-vision suggestion.
export function pickSideView(signTypeName, visionKey = null, visionConfidence = 0) {
  const mapKey = SIGN_TO_SIDEVIEW[signTypeName] || null
  const vKey = visionKey && KEYS.has(visionKey) ? visionKey : null
  if (vKey && (vKey === mapKey || visionConfidence >= 0.8)) return { selected: vKey, candidates: [vKey] }
  if (mapKey && !vKey) return { selected: mapKey, candidates: [mapKey] }
  const candidates = [...new Set([mapKey, vKey].filter(Boolean))]
  return { selected: candidates[0] || null, candidates }
}
