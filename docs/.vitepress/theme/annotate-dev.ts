// docs/.vitepress/theme/annotate-dev.ts
// Dev-only section annotation system.
// Shows ⊕ buttons on h2/h3 headings. Click to add a note. Notes saved to localStorage.
// Speed dial bottom-right: copy all notes or clear all.
// Only active when import.meta.env.DEV === true.

const STORE_PREFIX = '__docnote_'

function getNotes(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!
    if (k.startsWith(STORE_PREFIX)) out[k.slice(STORE_PREFIX.length)] = localStorage.getItem(k)!
  }
  return out
}

function saveNote(id: string, text: string) {
  if (text.trim()) localStorage.setItem(STORE_PREFIX + id, text)
  else localStorage.removeItem(STORE_PREFIX + id)
}

export function initDevAnnotations() {
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV) return
  if ((window as any).__devAnnotationsLoaded) return
  ;(window as any).__devAnnotationsLoaded = true

  // Styles
  const style = document.createElement('style')
  style.textContent = `
  .__da-btn{display:inline-flex;align-items:center;justify-content:center;
    width:18px;height:18px;border-radius:50%;border:1.5px solid #a5b4fc;
    background:transparent;cursor:pointer;font-size:11px;line-height:1;
    color:#a5b4fc;margin-left:8px;vertical-align:middle;flex-shrink:0;
    transition:background .15s,color .15s}
  .__da-btn:hover{background:#a5b4fc;color:#fff}
  .__da-btn.__da-has-note{border-color:#6366f1;color:#6366f1;background:#eef2ff}
  .__da-btn.__da-has-note:hover{background:#6366f1;color:#fff}
  .__da-pop{position:fixed;background:#1e1e2e;border:1px solid #3b3b5c;border-radius:8px;
    box-shadow:0 8px 32px rgba(0,0,0,.5);padding:12px;z-index:999999;width:320px;
    font:13px/1.5 system-ui,sans-serif}
  .__da-pop .hd{color:#a5b4fc;font-size:11px;font-weight:600;margin-bottom:8px;
    display:flex;justify-content:space-between;align-items:center}
  .__da-pop .hd button{background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;line-height:1;padding:0}
  .__da-pop .hd button:hover{color:#fff}
  .__da-pop textarea{width:100%;box-sizing:border-box;background:#2a2a3e;color:#e2e8f0;
    border:1px solid #3b3b5c;border-radius:5px;padding:8px;font-size:12px;
    font-family:inherit;resize:vertical;min-height:80px;outline:none}
  .__da-pop textarea:focus{border-color:#6366f1}
  .__da-pop .ft{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
  .__da-pop .ft span{font-size:10px;color:#4b5563}
  .__da-pop .ft button{font-size:11px;padding:4px 10px;border-radius:4px;border:none;cursor:pointer;
    background:#6366f1;color:#fff;font-weight:500}
  .__da-pop .ft button:hover{background:#4f46e5}
  .__da-dial{position:fixed;bottom:24px;right:24px;z-index:999998;
    display:flex;flex-direction:column;align-items:flex-end;gap:8px}
  .__da-dial-main{width:44px;height:44px;border-radius:50%;background:#6366f1;
    color:#fff;border:none;cursor:pointer;font-size:20px;display:flex;
    align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(99,102,241,.4)}
  .__da-dial-main:hover{background:#4f46e5}
  .__da-dial-actions{display:none;flex-direction:column;align-items:flex-end;gap:6px}
  .__da-dial-actions.open{display:flex}
  .__da-dial-action{display:flex;align-items:center;gap:8px;cursor:pointer}
  .__da-dial-action span{background:#1e1e2e;border:1px solid #3b3b5c;color:#e2e8f0;
    font-size:11px;padding:4px 10px;border-radius:20px;white-space:nowrap}
  .__da-dial-action button{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;font-size:16px}
  .__da-copy-btn{background:#6366f1;color:#fff}
  .__da-copy-btn:hover{background:#4f46e5}
  .__da-clear-btn{background:#374151;color:#9ca3af}
  .__da-clear-btn:hover{background:#ef4444;color:#fff}
  .__da-badge{position:absolute;top:-4px;right:-4px;width:16px;height:16px;
    border-radius:50%;background:#f59e0b;color:#000;font-size:9px;font-weight:700;
    display:flex;align-items:center;justify-content:center;pointer-events:none}
  .__da-dial-main-wrap{position:relative;display:inline-block}
  `
  document.head.appendChild(style)

  let popover: HTMLElement | null = null

  function closePopover() {
    if (popover) { popover.remove(); popover = null }
  }

  function openPopover(btn: HTMLElement, id: string) {
    if (popover) { closePopover(); return }
    const saved = localStorage.getItem(STORE_PREFIX + id) || ''
    popover = document.createElement('div')
    popover.className = '__da-pop'

    const rect = btn.getBoundingClientRect()
    const top = Math.min(rect.bottom + 6, innerHeight - 220)
    const left = Math.min(rect.left, innerWidth - 336)
    popover.style.cssText = `top:${top}px;left:${left}px`

    popover.innerHTML = `
      <div class="hd">
        <span>#${id}</span>
        <button id=__da_close>×</button>
      </div>
      <textarea id=__da_ta placeholder="Note for this section…">${saved}</textarea>
      <div class="ft">
        <span>Cmd+Enter to save · Esc to close</span>
        <button id=__da_clear_note>Clear</button>
      </div>`
    document.body.appendChild(popover)

    const ta = document.getElementById('__da_ta') as HTMLTextAreaElement
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)

    const doSave = () => {
      saveNote(id, ta.value)
      refreshBtn(btn, id)
      refreshBadge()
      closePopover()
    }

    ta.oninput = () => { saveNote(id, ta.value); refreshBtn(btn, id); refreshBadge() }
    ta.onkeydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doSave()
      if (e.key === 'Escape') closePopover()
    }
    document.getElementById('__da_close')!.onclick = closePopover
    document.getElementById('__da_clear_note')!.onclick = () => {
      saveNote(id, '')
      refreshBtn(btn, id)
      refreshBadge()
      closePopover()
    }
  }

  function refreshBtn(btn: HTMLElement, id: string) {
    const has = !!localStorage.getItem(STORE_PREFIX + id)?.trim()
    btn.textContent = has ? '●' : '⊕'
    btn.classList.toggle('__da-has-note', has)
    btn.title = has ? `Note on #${id} (click to edit)` : `Add note to #${id}`
  }

  let badge: HTMLElement | null = null
  function refreshBadge() {
    const count = Object.keys(getNotes()).length
    if (badge) badge.textContent = count > 0 ? String(count) : ''
    if (badge) badge.style.display = count > 0 ? 'flex' : 'none'
  }

  function injectButtons() {
    document.querySelectorAll('h2[id], h3[id]').forEach(h => {
      const id = h.id
      if (h.querySelector('.__da-btn')) return // already injected
      const btn = document.createElement('button')
      btn.className = '__da-btn'
      btn.dataset.daId = id
      refreshBtn(btn, id)
      btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openPopover(btn, id) }
      h.appendChild(btn)
    })
    refreshBadge()
  }

  // Speed dial
  const dial = document.createElement('div')
  dial.className = '__da-dial'
  dial.innerHTML = `
    <div class="__da-dial-actions" id=__da_actions>
      <div class="__da-dial-action">
        <span>Copy all notes</span>
        <button class="__da-copy-btn" id=__da_copy>📋</button>
      </div>
      <div class="__da-dial-action">
        <span>Clear all notes</span>
        <button class="__da-clear-btn" id=__da_clear_all>🗑</button>
      </div>
    </div>
    <div class="__da-dial-main-wrap">
      <button class="__da-dial-main" id=__da_dial_main title="Doc notes">✏️</button>
      <span class="__da-badge" id=__da_badge style="display:none"></span>
    </div>`
  document.body.appendChild(dial)
  badge = document.getElementById('__da_badge')

  document.getElementById('__da_dial_main')!.onclick = () => {
    document.getElementById('__da_actions')!.classList.toggle('open')
  }

  document.getElementById('__da_copy')!.onclick = async () => {
    const notes = getNotes()
    if (!Object.keys(notes).length) { alert('No notes yet.'); return }
    const text = Object.entries(notes).map(([id, note]) => `#${id}\n${note}`).join('\n\n')
    await navigator.clipboard.writeText(text)
    const btn = document.getElementById('__da_copy')!
    btn.textContent = '✓'
    setTimeout(() => btn.textContent = '📋', 1500)
  }

  document.getElementById('__da_clear_all')!.onclick = () => {
    if (!confirm('Clear all doc notes?')) return
    Object.keys(getNotes()).forEach(id => localStorage.removeItem(STORE_PREFIX + id))
    document.querySelectorAll<HTMLElement>('.__da-btn').forEach(btn => {
      refreshBtn(btn, btn.dataset.daId!)
    })
    refreshBadge()
  }

  // Close popover on outside click
  document.addEventListener('click', (e) => {
    if (popover && !popover.contains(e.target as Node)) closePopover()
  })

  // Initial inject + re-inject on VitePress route changes
  injectButtons()
  // Re-run after a short delay to catch VitePress hydration
  setTimeout(injectButtons, 300)

  // Watch for DOM changes (VitePress SPA navigation)
  const observer = new MutationObserver(() => {
    setTimeout(injectButtons, 100)
  })
  observer.observe(document.getElementById('app') || document.body, {
    childList: true, subtree: true
  })
}
