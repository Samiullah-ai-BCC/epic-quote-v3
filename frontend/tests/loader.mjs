// Node needs explicit file extensions in ESM; Vite does not, and the app's source is written for
// Vite. Rather than rewrite import specifiers across the generator modules purely to satisfy the
// test runner — churn in working code, for no runtime gain — this resolver adds the extension the
// same way the bundler does.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

export function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL)
    for (const ext of ['.js', '.jsx', '.mjs']) {
      const cand = new URL(base.href + ext)
      if (existsSync(fileURLToPath(cand))) return next(base.href + ext, context)
    }
  }
  return next(specifier, context)
}
