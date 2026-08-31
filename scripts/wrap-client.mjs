// Wrap tsc output lib/client.js into the lazy CJS closure factory
// matching deepseek-harness packages/client/tsdown.client.ts format:
//
// window.__ModuleLoader__.load({ id: "<id>", factory: (require) => {
// var module = { exports: {} }; var exports = module.exports;
// ...module body...
// return module.exports; } });

import { readFileSync, writeFileSync } from 'node:fs'

const id = 'dsh-logo-custom'
const path = new URL('../lib/client.js', import.meta.url)

let body = readFileSync(path, 'utf8')
// Strip trailing `export {};` appended by tsc for files without imports/exports
body = body.replace(/\nexport \{\};?\s*$/, '\n')

const banner = `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`
const intro = 'var module = { exports: {} }; var exports = module.exports;'
const footer = 'return module.exports; } });'

writeFileSync(path, `${banner}\n${intro}\n${body}${footer}\n`)
console.log(`wrap-client: ${path.pathname} wrapped as ${id}`)
