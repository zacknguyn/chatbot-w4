import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { randomUUID } from '../utils/uuid'
import LevelTabs from './LevelTabs'
import type { FontFamily, FontSize } from '../App'
import type { ChunkDetail, ToolCall, TraceEntry } from './RightSidebar'

const API_URL = import.meta.env.VITE_API_URL as string | undefined

export interface Message {
  id: string
  sender: 'user' | 'ai' | 'loading'
  text?: string
  kbSources?: string[]
  chunksDetail?: ChunkDetail[]
  toolsUsed?: ToolCall[]
  level?: string
  ts?: number
  rawLog?: unknown
}

interface Props {
  level: number
  onLevelChange: (l: number) => void
  sessionId: string
  fontFamily: FontFamily
  fontSize: FontSize
  prefill: string
  onPrefillConsumed: () => void
  onToolsUsed: (entry: TraceEntry) => void
  onBusyChange: (busy: boolean) => void
  resetKey: string
}

const LOADING_LABELS = [
  'Searching knowledge base…',
  'Querying database…',
  'Checking live metrics…',
  'Reading postmortems…',
  'Cross-referencing docs…',
  'Pulling SLA targets…',
]

const SUGGESTIONS = [
  'What is the current status of PaymentGW?',
  'Which service had the most incidents last quarter?',
  'What are the SLA targets for AuthSvc?',
  'Show me monthly costs for OrderSvc',
]

function formatText(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function renderMd(text: string) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--surface-card);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/^### (.*$)/gm, '<div style="font-weight:600;margin-top:8px;margin-bottom:4px">$1</div>')
    .replace(/^## (.*$)/gm, '<div style="font-weight:700;margin-top:10px;margin-bottom:4px">$1</div>')
    .replace(/\n/g, '<br>')
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

function LogModal({ log, onClose }: { log: unknown; onClose: () => void }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 860, maxHeight: '85vh', background: 'var(--bg-chat)', border: '1px solid var(--border-color)', borderRadius: 'var(--r-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>Backend Response Log</span>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 'var(--r-pill)', background: 'var(--surface-card)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <pre style={{ margin: 0, flex: 1, overflowY: 'auto', padding: 16, fontSize: 11, lineHeight: 1.6, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-chat)' }}>
          {JSON.stringify(log, null, 2)}
        </pre>
      </div>
    </div>,
    document.body
  )
}

function InlineTools({ tools }: { tools: ToolCall[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        {tools.length} tool{tools.length !== 1 ? 's' : ''} used
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {tools.map((call, i) => (
          <div key={i} style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
              width: '100%', textAlign: 'left', padding: '6px 10px',
              background: 'var(--surface-card)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: call.status === 'success' ? '#5db872' : '#c64545' }} />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>{call.step}.</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{call.tool}</span>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                {call.action_group.split('-').slice(1).join('-') || call.action_group}
              </span>
              <Chevron open={openIdx === i} />
            </button>
            {openIdx === i && (
              <div style={{ padding: '8px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-chat)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ color: 'var(--muted)', wordBreak: 'break-all' }}>{call.api_endpoint}</div>
                <div><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>in: </span>{JSON.stringify(call.input)}</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflowY: 'auto' }}>
                  {JSON.stringify(call.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function InlineSources({ sources, chunks, level }: { sources: string[]; chunks: ChunkDetail[]; level?: string }) {
  const [open, setOpen] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [mdIdx, setMdIdx] = useState<Set<number>>(new Set())

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: 'var(--text-secondary)', fontSize: 11,
      }}>
        <Chevron open={open} />
        {level && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'var(--primary)', color: 'var(--on-primary)' }}>
            {level.split(' ')[0]}
          </span>
        )}
        {sources.length} source{sources.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {chunks.length > 0 ? chunks.map((chunk, i) => (
            <div key={i} style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
                width: '100%', textAlign: 'left', padding: '7px 10px',
                background: 'var(--surface-card)', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{chunk.source}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{chunk.score.toFixed(3)}</span>
                  <Chevron open={openIdx === i} />
                </div>
                <div style={{ height: 2, background: 'var(--border-color)', borderRadius: 1 }}>
                  <div style={{ width: `${Math.round(chunk.score * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: 1 }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{chunk.lines} · {chunk.char_count} chars</div>
              </button>
              {openIdx === i && (() => {
                const isMd = chunk.source.endsWith('.md')
                const isRendered = mdIdx.has(i)
                return (
                  <>
                    {isMd && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0', borderTop: '1px solid var(--border-color)', background: 'var(--bg-chat)' }}>
                        <button onClick={() => setMdIdx(s => { const n = new Set(s); isRendered ? n.delete(i) : n.add(i); return n })} style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)',
                          border: '1px solid var(--border-color)',
                          background: isRendered ? 'var(--primary)' : 'none',
                          color: isRendered ? 'var(--on-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}>
                          {isRendered ? 'Raw' : 'Rendered'}
                        </button>
                      </div>
                    )}
                    {isRendered
                      ? <div style={{ padding: '8px 10px', fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', borderTop: isMd ? 'none' : '1px solid var(--border-color)', maxHeight: 200, overflowY: 'auto', background: 'var(--bg-chat)' }} dangerouslySetInnerHTML={{ __html: renderMd(chunk.text_preview) }} />
                      : <pre style={{ margin: 0, padding: '8px 10px', fontSize: 10, lineHeight: 1.6, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderTop: '1px solid var(--border-color)', maxHeight: 200, overflowY: 'auto', background: 'var(--bg-chat)' }}>{chunk.text_preview}</pre>
                    }
                  </>
                )
              })()}
            </div>
          )) : sources.map((src, i) => (
            <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--surface-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', display: 'inline-block' }}>{src}</span>
          ))}
        </div>
      )}
    </div>
  )
}

const BoltAvatar = () => (
  <div style={{ width: 28, height: 28, borderRadius: 'var(--r-pill)', flexShrink: 0, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--on-primary)" aria-hidden="true"><path d="M13 2L3 14h9v8l9-12h-9V2z"/></svg>
  </div>
)

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

export default function ChatShell({ level, onLevelChange, sessionId, fontFamily, fontSize, prefill, onPrefillConsumed, onToolsUsed, onBusyChange, resetKey }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState(LOADING_LABELS[0])
  const [logMsg, setLogMsg] = useState<unknown>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }, [resetKey])

  useEffect(() => {
    if (prefill) { setInput(prefill); onPrefillConsumed(); inputRef.current?.focus() }
  }, [prefill, onPrefillConsumed])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (q = input.trim()) => {
    if (!q || busy) return
    if (!API_URL) {
      setMessages(prev => [...prev, { id: randomUUID(), sender: 'ai', text: '❌ VITE_API_URL is not set.' }])
      return
    }
    setInput('')
    setBusy(true)
    onBusyChange(true)
    setLoadingLabel(LOADING_LABELS[Math.floor(Math.random() * LOADING_LABELS.length)])
    setMessages(prev => [...prev, { id: randomUUID(), sender: 'user', text: q, ts: Date.now() }, { id: 'loading', sender: 'loading' }])

    try {
      const body: Record<string, unknown> = { question: q, session_id: sessionId }
      if (level > 0) body.level = level
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      let data = await res.json()
      if (typeof data.body === 'string') data = JSON.parse(data.body)
      else if (data.body) data = data.body
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)

      const aiId = randomUUID()
      const entry: TraceEntry = {
        msgId: aiId,
        kbSources: data.kb_sources ?? [],
        chunksDetail: (data.chunks_detail ?? []) as ChunkDetail[],
        toolsUsed: (data.tools_used ?? []) as ToolCall[],
        level: data.level ?? '',
        reasoning: data.reasoning ?? [],
      }
      onToolsUsed(entry)
      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: aiId, sender: 'ai',
        text: data.answer ?? '⚠️ Empty response',
        kbSources: entry.kbSources, chunksDetail: entry.chunksDetail,
        toolsUsed: entry.toolsUsed, level: entry.level, ts: Date.now(),
        rawLog: data,
      }))
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({ id: randomUUID(), sender: 'ai', text: `❌ ${(err as Error).message}` }))
    } finally {
      setBusy(false); onBusyChange(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-chat)' }}>

      {/* Message area */}
      <div role="log" aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: isEmpty ? '0' : '24px 24px 8px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Welcome screen */}
        {isEmpty && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '48px 32px', textAlign: 'center' }}>
            {/* Logo */}
            <div style={{ width: 56, height: 56, borderRadius: 'var(--r-xl)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(204,120,92,0.3)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--on-primary)" aria-hidden="true"><path d="M13 2L3 14h9v8l9-12h-9V2z"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 8 }}>
                GeekBrain Ops Copilot
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 380 }}>
                Ask about service health, incidents, SLA compliance, cost trends, or team ownership.
              </div>
            </div>
            {/* Suggestion chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  padding: '8px 14px', borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-card)',
                  color: 'var(--text-primary)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  textAlign: 'left', lineHeight: 1.4,
                  transition: 'border-color 150ms ease',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => {
          const isUser = msg.sender === 'user'
          const time = msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-start' }}>
              {!isUser && <BoltAvatar />}
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: isUser ? '76%' : '86%', gap: 4 }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: isUser ? 'var(--r-lg) var(--r-lg) var(--r-sm) var(--r-lg)' : 'var(--r-sm) var(--r-lg) var(--r-lg) var(--r-lg)',
                  background: isUser ? 'var(--primary)' : 'var(--bg-message-ai)',
                  color: isUser ? 'var(--on-primary)' : 'var(--body-text)',
                  border: isUser ? 'none' : '1px solid var(--border-color)',
                  fontSize: fontSize === 'sm' ? 13 : fontSize === 'lg' ? 16 : 14,
                  lineHeight: 1.65,
                  fontFamily: `"${fontFamily}", ${fontFamily === 'Lora' || fontFamily === 'Source Serif 4' ? 'serif' : 'sans-serif'}`,
                  boxShadow: isUser ? '0 1px 4px rgba(204,120,92,0.2)' : '0 1px 3px rgba(20,20,19,0.05)',
                }}>
                  {msg.sender === 'loading' ? (
                    <span role="status" aria-label="Loading response" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ display: 'flex', gap: 4 }}>
                        {[0, 0.18, 0.36].map((delay, i) => (
                          <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', animation: `pulse 1s ${delay}s infinite alternate` }} />
                        ))}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{loadingLabel}</span>
                    </span>
                  ) : (
                    <>
                      <span dangerouslySetInnerHTML={{ __html: formatText(msg.text ?? '') }} />
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && <InlineTools tools={msg.toolsUsed} />}
                      {msg.kbSources && msg.kbSources.length > 0 && <InlineSources sources={msg.kbSources} chunks={msg.chunksDetail ?? []} level={msg.level} />}
                      {msg.rawLog && (
                        <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                          <button onClick={() => setLogMsg(msg.rawLog)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            View Logs
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {time && msg.sender !== 'loading' && (
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>{time}</div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-chat)', padding: '10px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Input row */}
        <div className="input-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            aria-label="Message"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about services, incidents, costs…"
            disabled={busy}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,120,92,0.12)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none' }}
            style={{
              flex: 1, padding: '10px 16px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 14, fontFamily: 'var(--font-body)',
              outline: 'none', transition: 'border-color 150ms ease, box-shadow 150ms ease',
            }}
          />
          <button
            aria-label="Send message"
            onClick={() => send()}
            disabled={busy}
            style={{
              width: 40, height: 40, borderRadius: 'var(--r-pill)',
              background: busy ? 'var(--border-color)' : 'var(--primary)',
              border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--primary-active)' }}
            onMouseLeave={e => { if (!busy) e.currentTarget.style.background = 'var(--primary)' }}
          >
            <SendIcon />
          </button>
        </div>
        {/* Level selector row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>Level</span>
          <LevelTabs level={level} onChange={onLevelChange} />
        </div>
      </div>
      {logMsg != null && <LogModal log={logMsg} onClose={() => setLogMsg(null)} />}
    </div>
  )
}
