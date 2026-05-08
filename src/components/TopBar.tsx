import { useState, useRef, useEffect } from 'react'
import type { FontFamily, FontSize } from '../App'

interface Props {
  sessionId: string
  dark: boolean
  busy: boolean
  fontFamily: FontFamily
  fontSize: FontSize
  onToggleDark: () => void
  onNewChat: () => void
  onFontFamilyChange: (f: FontFamily) => void
  onFontSizeChange: (s: FontSize) => void
}

const FONT_FAMILIES: { value: FontFamily; label: string; stack: string }[] = [
  { value: 'Inter',          label: 'Inter',          stack: 'Inter, sans-serif' },
  { value: 'DM Sans',        label: 'DM Sans',        stack: '"DM Sans", sans-serif' },
  { value: 'IBM Plex Sans',  label: 'IBM Plex Sans',  stack: '"IBM Plex Sans", sans-serif' },
  { value: 'Lora',           label: 'Lora',           stack: 'Lora, serif' },
  { value: 'Source Serif 4', label: 'Source Serif 4', stack: '"Source Serif 4", serif' },
]

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
]

const BoltIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2L3 14h9v8l9-12h-9V2z"/>
  </svg>
)

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const iconBtn: React.CSSProperties = {
  width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 'var(--r-md)',
  background: 'none', border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)', cursor: 'pointer',
}

export default function TopBar({ sessionId, dark, busy, fontFamily, fontSize, onToggleDark, onNewChat, onFontFamilyChange, onFontSizeChange }: Props) {
  const [copied, setCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [settingsOpen])

  const copySession = () => {
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{
      background: 'var(--bg-chat)',
      borderBottom: '1px solid var(--border-color)',
      height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--r-md)',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <BoltIcon />
        </div>
        <div className="topbar-title" style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          GeekBrain Ops Copilot
        </div>
        <div title={busy ? 'Processing…' : 'Ready'} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: busy ? '#e8a55a' : '#5db872',
          boxShadow: busy ? '0 0 0 2px rgba(232,165,90,0.25)' : '0 0 0 2px rgba(93,184,114,0.25)',
          transition: 'background 300ms ease', flexShrink: 0,
        }} />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={copySession}
          title={copied ? 'Copied!' : 'Copy session ID'}
          style={{
            height: 30, padding: '0 10px',
            borderRadius: 'var(--r-pill)',
            background: 'none', border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.3px',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        >
          {copied ? '✓ copied' : sessionId}
        </button>

        <button
          onClick={onToggleDark}
          title={dark ? 'Light mode' : 'Dark mode'}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={iconBtn}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-card)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Settings gear */}
        <div ref={settingsRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            title="Settings"
            style={{ ...iconBtn, background: settingsOpen ? 'var(--surface-card)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-card)')}
            onMouseLeave={e => { if (!settingsOpen) e.currentTarget.style.background = 'none' }}
          >
            <GearIcon />
          </button>

          {settingsOpen && (
            <div style={{
              position: 'absolute', top: 40, right: 0, zIndex: 100,
              background: 'var(--bg-chat)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--r-lg)',
              padding: '14px 16px',
              width: 220,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {/* Font family */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Font
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {FONT_FAMILIES.map(f => (
                    <button
                      key={f.value}
                      onClick={() => onFontFamilyChange(f.value)}
                      style={{
                        textAlign: 'left', padding: '6px 10px',
                        borderRadius: 'var(--r-md)',
                        border: fontFamily === f.value ? '1px solid var(--primary)' : '1px solid transparent',
                        background: fontFamily === f.value ? 'rgba(204,120,92,0.08)' : 'none',
                        color: fontFamily === f.value ? 'var(--primary)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontFamily: f.stack,
                        fontSize: 13,
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Size
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FONT_SIZES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => onFontSizeChange(s.value)}
                      style={{
                        flex: 1, padding: '5px 0',
                        borderRadius: 'var(--r-md)',
                        border: fontSize === s.value ? 'none' : '1px solid var(--border-color)',
                        background: fontSize === s.value ? 'var(--primary)' : 'none',
                        color: fontSize === s.value ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onNewChat}
          title="New chat"
          style={{
            height: 32, padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 6,
            borderRadius: 'var(--r-pill)',
            background: 'var(--primary)', border: 'none',
            color: '#fff', cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-active)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
        >
          + New Chat
        </button>
      </div>
    </div>
  )
}
