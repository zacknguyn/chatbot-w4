import React, { useState } from 'react'
import { createPortal } from 'react-dom'

export interface ChunkDetail {
  chunk_index: number
  source: string
  score: number
  lines: string
  char_count: number
  text_preview: string
}

export interface ToolCall {
  step: number
  action_group: string
  tool: string
  api_endpoint: string
  input: Record<string, unknown>
  result: unknown
  status: 'success' | 'error'
}

export interface TraceEntry {
  msgId: string
  kbSources: string[]
  chunksDetail: ChunkDetail[]
  toolsUsed: ToolCall[]
  level: string
  reasoning?: (string | { step: number; action_group: string; tool_called: string; api_endpoint: string; input: unknown; status: string })[]
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const ExpandIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860, maxHeight: '85vh',
          background: 'var(--bg-chat)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 'var(--r-pill)',
              background: 'var(--surface-card)', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        {/* Modal body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.8px',
      textTransform: 'uppercase', color: 'var(--text-secondary)',
      padding: '14px 14px 8px',
      borderBottom: '1px solid var(--border-color)',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function ChunkCard({ chunk }: { chunk: ChunkDetail }) {
  const [open, setOpen] = useState(false)
  const [mdView, setMdView] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const pct = Math.round(chunk.score * 100)
  const isMd = chunk.source.endsWith('.md')

  const renderMd = (text: string) => {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:var(--surface-card);padding:1px 4px;border-radius:3px;font-size:9px">$1</code>')
      .replace(/^### (.*$)/gm, '<div style="font-weight:600;margin-top:8px;margin-bottom:4px">$1</div>')
      .replace(/^## (.*$)/gm, '<div style="font-weight:600;font-size:11px;margin-top:8px;margin-bottom:4px">$1</div>')
      .replace(/\n/g, '<br>')
  }

  return (
    <>
    <div style={{
      borderRadius: 'var(--r-md)', overflow: 'hidden',
      border: '1px solid var(--border-color)', marginBottom: 4,
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '9px 12px',
          background: 'var(--surface-card)', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: 5,
        }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o) }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {chunk.source}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setFullscreen(true) }}
            title="Open fullscreen"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <ExpandIcon />
          </button>
          <Chevron open={open} />
        </div>
        {/* Score bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 3, background: 'var(--border-color)', borderRadius: 2 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 70 ? 'var(--primary)' : pct > 40 ? '#e8a55a' : 'var(--muted)', borderRadius: 2, transition: 'width 400ms ease' }} />
          </div>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flexShrink: 0 }}>
            {chunk.score.toFixed(3)}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {chunk.lines} · {chunk.char_count} chars
        </span>
      </div>
      {open && (
        <>
          {isMd && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0', borderTop: '1px solid var(--border-color)', background: 'var(--bg-chat)' }}>
              <button
                onClick={() => setMdView(v => !v)}
                style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--border-color)',
                  background: mdView ? 'var(--primary)' : 'none',
                  color: mdView ? 'var(--on-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}
              >
                {mdView ? 'Raw' : 'Rendered'}
              </button>
            </div>
          )}
          {mdView ? (
            <div style={{
              padding: '8px 10px', fontSize: 11, lineHeight: 1.6,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
              borderTop: isMd ? 'none' : '1px solid var(--border-color)',
              maxHeight: 200, overflowY: 'auto',
              background: 'var(--bg-chat)',
            }}
              dangerouslySetInnerHTML={{ __html: renderMd(chunk.text_preview) }}
            />
          ) : (
            <pre style={{
              margin: 0, padding: '8px 10px',
              fontSize: 10, lineHeight: 1.6,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              borderTop: '1px solid var(--border-color)',
              maxHeight: 200, overflowY: 'auto',
              background: 'var(--bg-chat)',
            }}>
              {chunk.text_preview}
            </pre>
          )}
        </>
      )}
    </div>
    {fullscreen && (
      <Modal title={chunk.source} onClose={() => setFullscreen(false)}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          {isMd && (
            <button
              onClick={() => setMdView(v => !v)}
              style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 'var(--r-pill)',
                border: '1px solid var(--border-color)',
                background: mdView ? 'var(--primary)' : 'none',
                color: mdView ? 'var(--on-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              {mdView ? 'Raw' : 'Rendered'}
            </button>
          )}
        </div>
        {mdView ? (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--body-text)', fontFamily: 'var(--font-body)' }}
            dangerouslySetInnerHTML={{ __html: renderMd(chunk.text_preview) }}
          />
        ) : (
          <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {chunk.text_preview}
          </pre>
        )}
      </Modal>
    )}
  </>
  )
}

function ToolStep({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const ag = ((call.action_group ?? '').split('-').slice(1).join('-') || call.action_group || 'unknown')
    .replace(/([A-Z])/g, ' $1').trim()

  return (
    <>
    <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: 4 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '9px 12px',
          background: 'var(--surface-card)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o) }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: call.status === 'success' ? '#5db872' : '#c64545',
          boxShadow: call.status === 'success' ? '0 0 0 2px rgba(93,184,114,0.2)' : '0 0 0 2px rgba(198,69,69,0.2)',
        }} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{call.step}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{call.tool}</span>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--border-color)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', flexShrink: 0, whiteSpace: 'nowrap' }}>{ag}</span>
        <button
          onClick={e => { e.stopPropagation(); setFullscreen(true) }}
          title="Open fullscreen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <ExpandIcon />
        </button>
        <Chevron open={open} />
      </div>
      {open && (
        <div style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-chat)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ color: 'var(--muted)', wordBreak: 'break-all' }}>{call.api_endpoint}</div>
          <div><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>in: </span>{JSON.stringify(call.input)}</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflowY: 'auto' }}>
            {JSON.stringify(call.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
    {fullscreen && (
      <Modal title={`${call.step}. ${call.tool}`} onClose={() => setFullscreen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Endpoint</div>
            <div style={{ color: 'var(--muted)', wordBreak: 'break-all' }}>{call.api_endpoint}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Input</div>
            <pre style={{ margin: 0, background: 'var(--surface-card)', padding: '10px 12px', borderRadius: 'var(--r-md)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Result</div>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: call.status === 'success' ? '#5db872' : '#c64545', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{call.status}</span>
            </div>
            <pre style={{ margin: 0, background: 'var(--surface-card)', padding: '10px 12px', borderRadius: 'var(--r-md)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)', maxHeight: 400, overflowY: 'auto' }}>
              {JSON.stringify(call.result, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    )}
    </>
  )
}

interface Props { history: TraceEntry[]; open: boolean; onToggle: () => void }

export default function RightSidebar({ history, open, onToggle }: Props) {
  const latest = history.length > 0 ? history[history.length - 1] : null
  const [width, setWidth] = React.useState(268)
  const dragging = React.useRef(false)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setWidth(Math.max(200, Math.min(520, startW - (ev.clientX - startX))))
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!open) return (
    <aside className="sidebar-right" style={{
      width: 40, flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 8,
    }}>
      <button
        onClick={onToggle}
        title="Expand trace inspector"
        style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      </button>
    </aside>
  )

  return (
    <aside className="sidebar-right" style={{
      width, flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderLeft: '1px solid var(--border-color)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Drag handle */}
      <div onMouseDown={onMouseDown} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />
      <div style={{
        padding: '16px 14px 12px',
        fontSize: 11, fontWeight: 600, letterSpacing: '1px',
        color: 'var(--text-secondary)', textTransform: 'uppercase',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Trace Inspector</span>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
      </div>

      {!latest ? (
        <div style={{ padding: '20px 14px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            When the agent uses tools — querying the database, calling the metrics API, or searching the knowledge base — each call appears here in order.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '12px 0 0' }}>
            L3–L5 questions typically trigger multiple tools.
          </p>
        </div>
      ) : (
        <>
          {latest.chunksDetail.length > 0 && (
            <div>
              <SectionLabel>KB Chunks · {latest.chunksDetail.length}</SectionLabel>
              <div style={{ padding: '0 8px 8px' }}>
                {latest.chunksDetail.map((chunk, i) => <ChunkCard key={i} chunk={chunk} />)}
              </div>
            </div>
          )}

          {latest.toolsUsed.length > 0 && (
            <div>
              <SectionLabel>Tool Calls · {latest.toolsUsed.length}</SectionLabel>
              <div style={{ padding: '0 8px 8px' }}>
                {latest.toolsUsed.map((call, i) => <ToolStep key={i} call={call} />)}
              </div>
            </div>
          )}

          {latest.reasoning && latest.reasoning.length > 0 && (
            <div>
              <SectionLabel>Reasoning Steps · {latest.reasoning.length}</SectionLabel>
              <div style={{ padding: '0 8px 8px' }}>
                {latest.reasoning.map((step, i) => {
                  const text = typeof step === 'string'
                    ? step
                    : 'tool_called' in step
                      ? `Called ${step.tool_called} (${step.action_group}) - ${step.status}`
                      : JSON.stringify(step)
                  return (
                    <div key={i} style={{
                      padding: '8px 10px',
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: 'var(--text-secondary)',
                      background: 'var(--surface-card)',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border-color)',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--primary)',
                        color: 'var(--on-primary)',
                        fontSize: 9,
                        fontWeight: 700,
                        marginRight: 8,
                        flexShrink: 0,
                      }}>{i + 1}</span>
                      {text}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {history.length > 1 && (
            <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
              Latest of {history.length} traced responses
            </div>
          )}
        </>
      )}
    </aside>
  )
}
