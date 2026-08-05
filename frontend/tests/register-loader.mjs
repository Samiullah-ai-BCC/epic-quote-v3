// Registers the extension-resolving hook (see loader.mjs) for `node --test`.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register('./loader.mjs', pathToFileURL('./tests/'))
