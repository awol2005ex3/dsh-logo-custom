/**
 * dsh-logo-custom — browser half.
 */

const PLUGIN_ID = 'dsh-logo-custom'
const LOGO_URL = '/dsh-logo-custom/logo'
const UPLOAD_URL = '/dsh-logo-custom/upload'
const WORDMARK_URL = '/dsh-logo-custom/wordmark'
const WORDMARK_UPLOAD_URL = '/dsh-logo-custom/wordmark-upload'

declare const module: { exports: unknown }

const win = window as unknown as { __dshLogoCustomMounted?: boolean }
const doc = document

/* ── Utility functions ── */

type ElProps = { style?: string; [key: string]: unknown }

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, props?: ElProps, children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === 'style') node.setAttribute('style', value as string)
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
      }
      else (node as unknown as Record<string, unknown>)[key] = value
    }
  }
  if (children) {
    for (const c of children) node.append(typeof c === 'string' ? doc.createTextNode(c) : c)
  }
  return node
}

/* ── Styles ── */

const PANEL_CSS = [
  'position:fixed;left:16px;bottom:64px;z-index:2147483646;width:380px;max-height:70vh;',
  'overflow:auto;background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:12px;',
  'box-shadow:0 8px 28px rgba(0,0,0,.18);font:13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;',
  'padding:14px;',
].join('')

const BTN_CSS = [
  'margin:4px 6px 4px 0;padding:5px 12px;font-size:12px;cursor:pointer;',
  'border:1px solid #d0d7de;background:#f6f8fa;color:#1f2328;border-radius:6px;',
].join('')

const PRIMARY_CSS = 'background:#1f6feb;color:#fff;border:1px solid #1f6feb;'
const DANGER_CSS = 'background:#cf222e;color:#fff;border:1px solid #cf222e;'

const SIDEBAR_BTN_CSS =
  'display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;' +
  'margin:4px 0;padding:8px 10px;font-size:13px;cursor:pointer;' +
  'border:1px solid rgba(127,127,127,.25);background:transparent;color:inherit;' +
  'border-radius:8px;'

const FLOAT_BTN_CSS = [
  'position:fixed;left:16px;bottom:64px;z-index:2147483645;',
  'padding:6px 12px;border:1px solid #d0d7de;background:#f6f8fa;',
  'color:#1f2328;border-radius:8px;cursor:pointer;font:13px/1.5 sans-serif;',
].join('')

const LOGO_IMG_CSS = 'max-width:24px;max-height:24px;object-fit:contain;border-radius:2px;display:block;'
const WORDMARK_IMG_CSS = 'max-width:160px;max-height:28px;object-fit:contain;display:block;'
const UPLOAD_AREA_CSS = [
  'border:2px dashed #d0d7de;border-radius:8px;padding:12px;text-align:center;',
  'cursor:pointer;transition:border-color .15s,background .15s;margin:6px 0;',
].join('')
const UPLOAD_AREA_HOVER_CSS = UPLOAD_AREA_CSS + 'border-color:#1f6feb;background:#f6f8fa;'

const SIDEBAR_SLOT = 'sidebar.footer.action'

/* ── Logo replacement logic ── */

let currentLogoUrl: string | null = null
let currentWordmarkUrl: string | null = null
let logoStyleEl: HTMLStyleElement | null = null
let logoRev = 0

function createLogoStyle(): HTMLStyleElement {
  if (logoStyleEl) return logoStyleEl
  const style = doc.createElement('style')
  style.dataset.plugin = PLUGIN_ID
  style.textContent = [
    '[data-dsh-logo-custom="active"] [data-slot="sidebar.brand.mark"] svg {',
    '  display: none !important;',
    '}',
    '[data-dsh-logo-custom="active"][data-dsh-wordmark="active"] [data-slot="sidebar.brand.name"] {',
    '  display: none !important;',
    '}',
    '[data-dsh-logo-custom="active"] [data-slot="sidebar.brand.name"]:empty {',
    '  display: none !important;',
    '}',
  ].join('\n')
  doc.head.appendChild(style)
  logoStyleEl = style
  return style
}

function applyCustomLogo(url: string): void {
  currentLogoUrl = url
  logoRev++
  createLogoStyle()

  const marks = doc.querySelectorAll('[data-slot="sidebar.brand.mark"]')
  marks.forEach(function (mark) {
    const existing = mark.querySelector('img[data-dsh-logo]') as HTMLImageElement | null
    if (existing) {
      existing.src = url + '?rev=' + logoRev
      return
    }
    const img = doc.createElement('img')
    img.src = url + '?rev=' + logoRev
    img.alt = 'Logo'
    img.setAttribute('style', LOGO_IMG_CSS)
    img.dataset.dshLogo = 'true'
    img.draggable = false
    mark.innerHTML = ''
    mark.appendChild(img)
  })

  marks.forEach(function (mark) {
    let parent = mark.parentElement
    while (parent) {
      if (parent.querySelector('[data-slot="sidebar.brand.mark"]')) {
        parent.dataset.dshLogoCustom = 'active'
        break
      }
      parent = parent.parentElement
    }
  })
}

function applyWordmark(url: string): void {
  currentWordmarkUrl = url
  logoRev++
  createLogoStyle()

  const names = doc.querySelectorAll('[data-slot="sidebar.brand.name"]')
  names.forEach(function (name) {
    const existing = name.querySelector('img[data-dsh-wordmark]') as HTMLImageElement | null
    if (existing) {
      existing.src = url + '?rev=' + logoRev
      return
    }
    const img = doc.createElement('img')
    img.src = url + '?rev=' + logoRev
    img.alt = 'Brand'
    img.setAttribute('style', WORDMARK_IMG_CSS)
    img.dataset.dshWordmark = 'true'
    img.draggable = false
    name.innerHTML = ''
    name.appendChild(img)
  })

  names.forEach(function (name) {
    let parent = name.parentElement
    while (parent) {
      if (parent.querySelector('[data-slot="sidebar.brand.name"]')) {
        parent.dataset.dshWordmark = 'active'
        break
      }
      parent = parent.parentElement
    }
  })
}

function removeCustomLogo(): void {
  currentLogoUrl = null
  currentWordmarkUrl = null
  if (logoStyleEl) { logoStyleEl.remove(); logoStyleEl = null }
  doc.querySelectorAll('img[data-dsh-logo]').forEach(function (img) { img.remove() })
  doc.querySelectorAll('img[data-dsh-wordmark]').forEach(function (img) { img.remove() })
  doc.querySelectorAll('[data-dsh-logo-custom="active"]').forEach(function (el) {
    delete (el as HTMLElement).dataset.dshLogoCustom
  })
  doc.querySelectorAll('[data-dsh-wordmark="active"]').forEach(function (el) {
    delete (el as HTMLElement).dataset.dshWordmark
  })
}

function syncLogo(): void {
  if (currentLogoUrl) {
    const url = currentLogoUrl
    const rev = logoRev
    doc.querySelectorAll('[data-slot="sidebar.brand.mark"]').forEach(function (mark) {
      const existing = mark.querySelector('img[data-dsh-logo]') as HTMLImageElement | null
      if (existing) {
        existing.src = url + '?rev=' + rev
      } else {
        const img = doc.createElement('img')
        img.src = url + '?rev=' + rev
        img.alt = 'Logo'
        img.setAttribute('style', LOGO_IMG_CSS)
        img.dataset.dshLogo = 'true'
        img.draggable = false
        mark.innerHTML = ''
        mark.appendChild(img)
        let parent = mark.parentElement
        while (parent) {
          if (parent.querySelector('[data-slot="sidebar.brand.mark"]')) {
            parent.dataset.dshLogoCustom = 'active'
            break
          }
          parent = parent.parentElement
        }
      }
    })
  }

  if (currentWordmarkUrl) {
    const url = currentWordmarkUrl
    const rev = logoRev
    doc.querySelectorAll('[data-slot="sidebar.brand.name"]').forEach(function (name) {
      const existing = name.querySelector('img[data-dsh-wordmark]') as HTMLImageElement | null
      if (existing) {
        existing.src = url + '?rev=' + rev
      } else {
        const img = doc.createElement('img')
        img.src = url + '?rev=' + rev
        img.alt = 'Brand'
        img.setAttribute('style', WORDMARK_IMG_CSS)
        img.dataset.dshWordmark = 'true'
        img.draggable = false
        name.innerHTML = ''
        name.appendChild(img)
        let parent = name.parentElement
        while (parent) {
          if (parent.querySelector('[data-slot="sidebar.brand.name"]')) {
            parent.dataset.dshWordmark = 'active'
            break
          }
          parent = parent.parentElement
        }
      }
    })
  }
}

/* ── Upload panel ── */

function buildPanel(): { root: HTMLElement; refresh: () => Promise<void> } {
  const status = el('div', { style: 'margin:6px 0;min-height:16px;color:#57606a;' })
  const previewBox = el('div', { style: 'margin:8px 0;text-align:center;min-height:40px;' })

  function makeUploadArea(accept: string, onUpload: (file: File) => Promise<void>, label: string): HTMLElement {
    const area = el('div', { style: UPLOAD_AREA_CSS })
    const text = el('div', { style: 'color:#57606a;font-size:12px;' }, [el('div', { textContent: label })])
    area.append(text)
    const input = doc.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.addEventListener('change', async function () {
      const file = input.files?.[0]
      if (file) await onUpload(file)
    })
    area.append(input)
    area.addEventListener('click', function () { input.click() })
    area.addEventListener('dragover', function (e) { e.preventDefault(); area.style.cssText = UPLOAD_AREA_HOVER_CSS })
    area.addEventListener('dragleave', function () { area.style.cssText = UPLOAD_AREA_CSS })
    area.addEventListener('drop', async function (e) {
      e.preventDefault()
      area.style.cssText = UPLOAD_AREA_CSS
      const file = e.dataTransfer?.files?.[0]
      if (file && file.type.startsWith('image/')) await onUpload(file)
    })
    return area
  }

  async function uploadLogo(file: File): Promise<void> {
    status.textContent = '上传Logo中...'
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(UPLOAD_URL, { method: 'POST', body: fd })
      if (!res.ok) {
        status.textContent = '✗ HTTP ' + res.status
        return
      }
      const text = await res.text()
      if (!text) {
        status.textContent = '✗ 空响应'
        return
      }
      const data = JSON.parse(text)
      if (data.ok) {
        applyCustomLogo(data.url)
        await refresh()
        status.textContent = '✓ Logo上传成功'
      } else {
        status.textContent = '✗ ' + (data.error || '')
      }
    } catch (err) {
      status.textContent = '✗ ' + (err instanceof Error ? err.message : String(err))
    }
  }

  async function uploadWordmark(file: File): Promise<void> {
    status.textContent = '上传品牌文字中...'
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(WORDMARK_UPLOAD_URL, { method: 'POST', body: fd })
      if (!res.ok) {
        status.textContent = '✗ HTTP ' + res.status
        return
      }
      const text = await res.text()
      if (!text) {
        status.textContent = '✗ 空响应'
        return
      }
      const data = JSON.parse(text)
      if (data.ok) {
        applyWordmark(data.url)
        await refresh()
        status.textContent = '✓ 品牌文字上传成功'
      } else {
        status.textContent = '✗ ' + (data.error || '')
      }
    } catch (err) {
      status.textContent = '✗ ' + (err instanceof Error ? err.message : String(err))
    }
  }

  const removeBtn = el('button', {
    textContent: '恢复默认',
    style: BTN_CSS + DANGER_CSS,
    onClick: async function () {
      status.textContent = '删除中...'
      try {
        await fetch(LOGO_URL, { method: 'DELETE' })
        await fetch(WORDMARK_URL, { method: 'DELETE' })
        removeCustomLogo()
        status.textContent = '✓ 已恢复默认'
        await refresh()
      } catch (err) {
        status.textContent = '✗ ' + (err instanceof Error ? err.message : String(err))
      }
    },
  })
  removeBtn.style.display = 'none'

  const closeBtn = el('button', {
    textContent: '✕',
    style: 'background:none;border:none;font-size:18px;cursor:pointer;color:#57606a;padding:0 4px;float:right;',
    onClick: function () { panel.style.display = 'none' },
  })

  const panel = el('div', { style: PANEL_CSS }, [
    el('div', { style: 'font-weight:700;font-size:14px;margin-bottom:6px;' }, [
      el('span', { textContent: '🎨 自定义Logo' }),
      closeBtn,
    ]),
    el('div', { style: 'font-size:12px;color:#57606a;margin-bottom:6px;', textContent: '替换侧边栏左上角的品牌图标和文字' }),
    previewBox,
    el('div', { style: 'font-weight:600;font-size:12px;color:#1f2328;margin-top:8px;', textContent: '品牌图标 (sidebar.brand.mark)' }),
    makeUploadArea('image/*', uploadLogo, '📁 点击或拖拽图标图片 (24×24)'),
    el('div', { style: 'font-weight:600;font-size:12px;color:#1f2328;margin-top:4px;', textContent: '品牌文字 (sidebar.brand.name)' }),
    makeUploadArea('image/*', uploadWordmark, '📁 点击或拖拽品牌横图 (160×28)'),
    el('div', { style: 'margin-top:8px;' }, [removeBtn]),
    status,
  ])

  async function refresh(): Promise<void> {
    try {
      // Use fetch to check both logo and wordmark status
      const [logoRes, wordmarkRes] = await Promise.all([
        fetch(LOGO_URL),
        fetch(WORDMARK_URL),
      ])

      previewBox.innerHTML = ''
      if (logoRes.ok) {
        applyCustomLogo(LOGO_URL)
        var img = el('img', { src: LOGO_URL + '?rev=' + logoRev, alt: 'Logo', style: 'max-width:120px;max-height:80px;border-radius:4px;border:1px solid #d0d7de;margin:2px;' })
        previewBox.append(img)
      }
      if (wordmarkRes.ok) {
        applyWordmark(WORDMARK_URL)
        var img2 = el('img', { src: WORDMARK_URL + '?rev=' + logoRev, alt: 'Wordmark', style: 'max-width:200px;max-height:40px;border-radius:4px;border:1px solid #d0d7de;margin:2px;' })
        previewBox.append(img2)
      }
      if (!logoRes.ok && !wordmarkRes.ok) {
        previewBox.append(el('div', { style: 'color:#8b949e;font-size:12px;', textContent: '当前使用默认Logo' }))
      }
      removeBtn.style.display = (logoRes.ok || wordmarkRes.ok) ? '' : 'none'
    } catch { status.textContent = '获取状态失败' }
  }

  return { root: panel, refresh }
}

/* ── Mount launcher ── */

function mountLauncher(launcher: HTMLButtonElement, onMutate?: () => void): void {
  const styleSidebar = function () { launcher.style.cssText = SIDEBAR_BTN_CSS }
  const styleFloat = function () { launcher.style.cssText = FLOAT_BTN_CSS }

  function ensureMounted() {
    const host = doc.querySelector('[data-slot="' + SIDEBAR_SLOT + '"]')
    if (host) {
      if (launcher.parentElement !== host) { host.append(launcher); styleSidebar() }
    } else if (launcher.parentElement !== doc.body) {
      doc.body.append(launcher); styleFloat()
    }
  }

  ensureMounted()
  const observer = new MutationObserver(function () {
    ensureMounted()
    syncLogo()
    if (onMutate) onMutate()
  })
  observer.observe(doc.documentElement, { childList: true, subtree: true })
}

/* ── Apply ── */

function apply(ctx: any): void {
  if (win.__dshLogoCustomMounted === true) return
  win.__dshLogoCustomMounted = true

  const handle = buildPanel()
  const panel = handle.root
  panel.style.display = 'none'
  panel.id = 'dsh-logo-custom-panel'
  doc.body.append(panel)

  const launcher = el('button', { textContent: '🖼️ Logo' })
  launcher.addEventListener('click', function () {
    if (panel.style.display === 'none') {
      panel.style.display = 'block'
      handle.refresh()
    } else {
      panel.style.display = 'none'
    }
  })
  launcher.id = 'dsh-logo-custom-launcher'
  mountLauncher(launcher)

  function restoreLogo() {
    fetch(LOGO_URL).then(function (r) {
      if (r.ok) applyCustomLogo(LOGO_URL)
    }).catch(function () {})
    fetch(WORDMARK_URL).then(function (r) {
      if (r.ok) applyWordmark(WORDMARK_URL)
    }).catch(function () {})
  }
  setTimeout(restoreLogo, 500)
  if (doc.readyState !== 'complete' && doc.readyState !== 'interactive') {
    doc.addEventListener('DOMContentLoaded', function () { setTimeout(restoreLogo, 200) })
  }
}

module.exports = { name: PLUGIN_ID, inject: [], apply }