/**
 * Page annotator — loaded in every build but only activates on demand.
 * Open DevTools on any page and run:  annotate()
 *
 * Comments persist in localStorage. Navigate freely; reload safely.
 * annotate()        → toggle comment mode on/off
 * annotate.clear()  → wipe all saved comments
 */

const STORE_KEY = '__ann_data'

export function initAnnotator() {
  if (typeof window === 'undefined') return

  // Already loaded (HMR / SPA nav won't re-run enhanceApp, but guard anyway)
  if ((window as any).__annLoaded) return
  ;(window as any).__annLoaded = true

  const annotations: { id: number; path: string; anchor: string; note: string }[] =
    JSON.parse(localStorage.getItem(STORE_KEY) || '[]')

  let active = false
  let hovered: Element | null = null
  let popover: HTMLElement | null = null

  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(annotations))
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
  .__ann-hl{outline:2px solid #f59e0b!important;background:rgba(245,158,11,.1)!important;cursor:crosshair!important}
  .__ann-pop{position:fixed;background:#fff;border:1px solid #e5e7eb;border-radius:8px;
    box-shadow:0 4px 20px rgba(0,0,0,.18);padding:12px;z-index:999999;width:300px;
    font:14px/1.4 system-ui,sans-serif}
  .__ann-pop textarea{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:4px;
    padding:6px 8px;font-size:13px;resize:vertical;min-height:64px;margin:6px 0;font-family:inherit}
  .__ann-pop textarea:focus{outline:none;border-color:#6366f1}
  .__ann-pop .row{display:flex;justify-content:flex-end;gap:6px;margin-top:4px}
  .__ann-pop button{padding:5px 12px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:500}
  .__ann-pop .ok{background:#6366f1;color:#fff} .__ann-pop .ok:hover{background:#4f46e5}
  .__ann-pop .cl{background:#f3f4f6;color:#374151} .__ann-pop .cl:hover{background:#e5e7eb}
  .__ann-panel{position:fixed;bottom:20px;right:20px;width:340px;max-height:62vh;
    background:#fff;border:1px solid #e5e7eb;border-radius:10px;
    box-shadow:0 4px 24px rgba(0,0,0,.14);z-index:999998;
    font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column}
  .__ann-panel .hd{padding:10px 14px;border-bottom:1px solid #f3f4f6;
    display:flex;align-items:center;justify-content:space-between}
  .__ann-panel .hd strong{font-size:13px}
  .__ann-badge{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600}
  .badge-on{background:#dcfce7;color:#166534} .badge-off{background:#f3f4f6;color:#6b7280}
  .__ann-panel .tgl{border:1px solid #d1d5db;border-radius:5px;padding:3px 8px;
    font-size:11px;cursor:pointer;background:#fff;color:#374151}
  .__ann-panel .tgl:hover{background:#f3f4f6}
  .__ann-list{overflow-y:auto;flex:1;padding:8px}
  .__ann-item{background:#f9fafb;border:1px solid #f3f4f6;border-radius:6px;
    padding:8px 10px;margin-bottom:6px;font-size:12px}
  .__ann-item .pg{color:#6366f1;font-weight:700;font-size:11px;margin-bottom:2px;
    display:flex;justify-content:space-between;align-items:center}
  .__ann-item .anc{color:#6b7280;font-style:italic;margin-bottom:4px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .__ann-item .del{background:none;border:none;cursor:pointer;color:#9ca3af;font-size:15px;line-height:1;padding:0}
  .__ann-item .del:hover{color:#ef4444}
  .__ann-panel .ft{padding:10px 14px;border-top:1px solid #f3f4f6;display:flex;gap:6px}
  .__ann-panel .ft button{flex:1;padding:6px;border-radius:5px;
    border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:12px;font-weight:500}
  .__ann-panel .ft button:hover{background:#f9fafb}
  .__ann-panel .ft .fc{border-color:#6366f1;color:#6366f1}
  .__ann-panel .ft .fg{border-color:#238636;color:#238636}
  .__ann-panel .ft .fx{border-color:#dc2626;color:#dc2626;flex:0 0 auto;padding:6px 10px}
  .__ann-persist{font-size:10px;color:#9ca3af;text-align:center;padding:3px 14px 6px;border-top:1px solid #f9fafb}
  `
  document.head.appendChild(style)

  // ── Panel ─────────────────────────────────────────────────────────────────
  const panel = document.createElement('div')
  panel.className = '__ann-panel'
  panel.style.display = 'none'
  panel.innerHTML = `
    <div class="hd">
      <strong>📝 Page Comments</strong>
      <div style="display:flex;align-items:center;gap:6px">
        <span id=__ann_badge class="__ann-badge badge-off">off</span>
        <button class="tgl" id=__ann_tgl>Start commenting</button>
      </div>
    </div>
    <div class="__ann-list" id=__ann_list></div>
    <div class="ft">
      <button class="fc" id=__ann_cc>Copy for Claude</button>
      <button class="fg" id=__ann_cg>Copy for GitHub</button>
      <button class="fx" id=__ann_clr title="Clear all">✕</button>
    </div>
    <div class="__ann-persist">💾 persists across reloads · navigate freely</div>`
  document.body.appendChild(panel)

  // ── Anchor detection ──────────────────────────────────────────────────────
  function getAnchor(el: Element): string {
    const codeBlock = el.closest('pre, .vp-code-group, [class*="language-"], .shiki')
    if (codeBlock) {
      let prev = codeBlock.previousElementSibling
      while (prev) {
        const h = prev.matches('h1,h2,h3,h4') ? prev : prev.querySelector('h1,h2,h3,h4')
        if (h) return `<code block near "${h.textContent!.trim().slice(0, 60)}">`
        prev = prev.previousElementSibling
      }
      const allH = [...document.querySelectorAll('h1,h2,h3,h4')]
      const elTop = el.getBoundingClientRect().top
      const above = allH.filter(h => h.getBoundingClientRect().top < elTop)
      if (above.length) return `<code block near "${above[above.length - 1].textContent!.trim().slice(0, 60)}">`
      return '<code block>'
    }

    let node: Element | null = el
    while (node && node !== document.body) {
      const t = ((node as HTMLElement).innerText || node.textContent || '').trim().replace(/\s+/g, ' ')
      if (t.length >= 6 && t.length <= 300) return t.length > 90 ? t.slice(0, 90) + '…' : t
      node = node.parentElement
    }

    const allH = [...document.querySelectorAll('h1,h2,h3,h4')]
    const elTop = el.getBoundingClientRect().top
    const above = allH.filter(h => h.getBoundingClientRect().top < elTop)
    if (above.length) return `<near "${above[above.length - 1].textContent!.trim().slice(0, 60)}">`
    return `<${el.tagName.toLowerCase()}>`
  }

  function getPath(): string {
    const base = location.pathname.match(/^(\/[^/]+\/pr-preview\/pr-\d+)/)?.[1] || ''
    return location.pathname.slice(base.length).replace(/\/$/, '') || '/'
  }

  function esc(s: string) { return s.replace(/"/g, '&quot;') }

  // ── Popover ───────────────────────────────────────────────────────────────
  function openPopover(e: MouseEvent, el: Element) {
    closePopover()
    const anchor = getAnchor(el)
    const path = getPath()
    popover = document.createElement('div')
    popover.className = '__ann-pop'
    popover.innerHTML = `
      <div style="font-size:11px;color:#6b7280;font-weight:600">${path}</div>
      <div style="font-size:12px;color:#374151;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:3px 0 0" title="${esc(anchor)}">${anchor}</div>
      <textarea id=__ann_inp placeholder="Your comment… (Cmd/Ctrl+Enter to save, Esc to cancel)"></textarea>
      <div class="row"><button class="ok" id=__ann_ok>Add</button><button class="cl" id=__ann_xcl>Cancel</button></div>`
    const x = Math.min(e.clientX, innerWidth - 316)
    const y = Math.min(e.clientY + 10, innerHeight - 160)
    popover.style.cssText += `;left:${x}px;top:${y}px`
    document.body.appendChild(popover)
    const inp = document.getElementById('__ann_inp') as HTMLTextAreaElement
    inp.focus()
    const doSave = () => { const v = inp.value.trim(); if (v) addNote(path, anchor, v); closePopover() }
    document.getElementById('__ann_ok')!.onclick = doSave
    document.getElementById('__ann_xcl')!.onclick = closePopover
    inp.onkeydown = ev => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') doSave()
      if (ev.key === 'Escape') closePopover()
    }
  }

  function closePopover() { if (popover) { popover.remove(); popover = null } }

  // ── Data ──────────────────────────────────────────────────────────────────
  function addNote(path: string, anchor: string, note: string) {
    annotations.push({ id: Date.now(), path, anchor, note })
    persist(); render()
  }

  function render() {
    const list = document.getElementById('__ann_list')!
    if (!annotations.length) {
      list.innerHTML = '<div class="__ann-empty">No comments yet.<br>Click "Start commenting" then click anything on the page.</div>'
      return
    }
    list.innerHTML = annotations.map(a => `
      <div class="__ann-item">
        <div class="pg">${a.path}<button class="del" data-id="${a.id}">×</button></div>
        <div class="anc" title="${esc(a.anchor)}">${a.anchor}</div>
        <div>${a.note}</div>
      </div>`).join('')
    list.querySelectorAll('.del').forEach(b => {
      ;(b as HTMLElement).onclick = () => {
        const id = +(b as HTMLElement).dataset.id!
        annotations.splice(annotations.findIndex(a => a.id === id), 1)
        persist(); render()
      }
    })
  }

  // ── Formatters ────────────────────────────────────────────────────────────
  function grouped() {
    const g: Record<string, typeof annotations> = {}
    annotations.forEach(a => (g[a.path] = g[a.path] || []).push(a))
    return g
  }

  function fmtClaude() {
    if (!annotations.length) return '(no comments)'
    return Object.entries(grouped()).map(([p, items]) =>
      `[${p}]\n` + items.map(a => `- ${a.anchor} — ${a.note}`).join('\n')
    ).join('\n\n')
  }

  function fmtGitHub() {
    if (!annotations.length) return '(no comments)'
    return `## Docs Review\n\n` + Object.entries(grouped()).map(([p, items]) =>
      `**\`${p}\`**\n` + items.map(a => `- *${a.anchor}* — ${a.note}`).join('\n')
    ).join('\n\n')
  }

  async function copy(text: string, btn: HTMLElement) {
    await navigator.clipboard.writeText(text)
    const orig = btn.textContent!; btn.textContent = '✓ Copied!'
    setTimeout(() => btn.textContent = orig, 1600)
  }

  document.getElementById('__ann_cc')!.onclick = function () { copy(fmtClaude(), this as HTMLElement) }
  document.getElementById('__ann_cg')!.onclick = function () { copy(fmtGitHub(), this as HTMLElement) }
  document.getElementById('__ann_clr')!.onclick = () => {
    if (confirm('Clear all comments?')) { annotations.length = 0; persist(); render() }
  }

  // ── Toggle ────────────────────────────────────────────────────────────────
  function toggle() {
    active = !active
    panel.style.display = active || annotations.length ? '' : 'none'
    document.getElementById('__ann_badge')!.className = '__ann-badge ' + (active ? 'badge-on' : 'badge-off')
    document.getElementById('__ann_badge')!.textContent = active ? 'on' : 'off'
    document.getElementById('__ann_tgl')!.textContent = active ? 'Stop' : 'Start commenting'
    document.body.style.cursor = active ? 'crosshair' : ''
    if (!active) closePopover()
    if (active) {
      panel.style.display = ''
      console.log('%c📝 Comment mode ON', 'color:#166534;font-weight:bold', '— click anything on the page')
    }
  }
  document.getElementById('__ann_tgl')!.onclick = toggle

  // ── Mouse events ──────────────────────────────────────────────────────────
  document.addEventListener('mouseover', e => {
    if (!active || (e.target as Element).closest('.__ann-panel,.__ann-pop')) return
    if (hovered) hovered.classList.remove('__ann-hl')
    hovered = e.target as Element
    hovered.classList.add('__ann-hl')
  }, true)

  document.addEventListener('mouseout', e => {
    if (hovered && !(e.target as Element).closest('.__ann-panel')) {
      hovered.classList.remove('__ann-hl'); hovered = null
    }
  }, true)

  document.addEventListener('click', e => {
    if (!active || (e.target as Element).closest('.__ann-panel,.__ann-pop')) return
    e.preventDefault(); e.stopPropagation()
    openPopover(e, e.target as Element)
  }, true)

  // Restore panel if there are saved comments
  if (annotations.length) { panel.style.display = ''; render() }

  // ── Public API ────────────────────────────────────────────────────────────
  const api = Object.assign(toggle, {
    clear: () => { annotations.length = 0; persist(); render() },
    copy: () => navigator.clipboard.writeText(fmtClaude()),
  })
  ;(window as any).annotate = api

  console.log(
    '%c📝 annotate()', 'color:#6366f1;font-weight:bold;font-size:13px',
    `ready — ${annotations.length} saved comment(s). Call annotate() to start.`
  )
}
