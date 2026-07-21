// Artwork / drawing helpers for the Generator — pure functions, no React state.
// Moved out of Generator.jsx verbatim (structural extraction only) to keep that
// file focused on the wizard's state machine.

// Cloudinary-stored PDF/Illustrator drawings can't render in an <img>/<iframe> directly —
// ask the CDN to rasterize page 1 to a PNG instead (free URL transformation).
export const isCloudDoc = (p) => /res\.cloudinary\.com/.test(p || '') && /\.(pdf|ai)$/i.test(p || '')
export const cloudRaster = (p, w = 1600) =>
  p.replace('/upload/', `/upload/pg_1,f_png,w_${w}/`).replace(/\.(pdf|ai)$/i, '.png')

// Crop a data-URL image to the AI-located artwork box. Tolerates every shape the model
// actually returns: an object, a JSON string, fractions 0..1, or raw pixel coordinates
// (normalized against the real image size). Falls back to the full image when the box is
// missing or implausible (tiny/inverted), so it can never lose data.
export const cropToBox = (dataUrl, boxIn) => new Promise((resolve) => {
  let box = boxIn
  if (typeof box === 'string') { try { box = JSON.parse(box.replace(/'/g, '"')) } catch { box = null } }
  if (!box || typeof box !== 'object') return resolve(dataUrl)
  // accept corner form {x1,y1,x2,y2} or box form {x,y,w,h}
  let nums = 'x1' in box
    ? [box.x1, box.y1, Number(box.x2) - Number(box.x1), Number(box.y2) - Number(box.y1)].map(Number)
    : [box.x, box.y, box.w, box.h].map(Number)
  if (nums.some((v) => !Number.isFinite(v) || v < 0)) return resolve(dataUrl)
  const img = new Image()
  img.onload = () => {
    try {
      let [x, y, w, h] = nums
      if (x > 1.5 || y > 1.5 || w > 1.5 || h > 1.5) {   // pixel coords → fractions
        x /= img.width; w /= img.width; y /= img.height; h /= img.height
      }
      // pad generously so an imprecise box never clips letters off the sign
      const PAD = 0.06
      x -= PAD; y -= PAD; w += PAD * 2; h += PAD * 2
      x = Math.min(Math.max(x, 0), 0.95); y = Math.min(Math.max(y, 0), 0.95)
      w = Math.min(w, 1 - x); h = Math.min(h, 1 - y)
      if (w < 0.12 || h < 0.08 || (w > 0.96 && h > 0.96)) return resolve(dataUrl)   // too small/whole page → keep page
      // JPEG + capped resolution: a PNG crop of a photo can blow past the 25MB upload limit
      const cw = Math.max(1, Math.round(img.width * w)), ch = Math.max(1, Math.round(img.height * h))
      const scale = Math.min(1, 1600 / Math.max(cw, ch))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(cw * scale))
      c.height = Math.max(1, Math.round(ch * scale))
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, img.width * x, img.height * y, cw, ch, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.92))
    } catch { resolve(dataUrl) }
  }
  img.onerror = () => resolve(dataUrl)
  img.src = dataUrl
})

export const urlToDataUrl = async (url) => {
  const blob = await (await fetch(url)).blob()
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
}
