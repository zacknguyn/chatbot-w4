import React, { useState } from 'react'
import { LEVELS } from '../data/questions'

const SHOW_INITIAL = 3

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
    style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

interface Props { onSelect: (question: string) => void; open: boolean; onToggle: () => void }

export default function LeftSidebar({ onSelect, open, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true })
  const [showMore, setShowMore] = useState<Record<number, boolean>>({})
  const [openAnswer, setOpenAnswer] = useState<string | null>(null)
  const [width, setWidth] = React.useState(248)
  const dragging = React.useRef(false)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setWidth(Math.max(180, Math.min(480, startW + (ev.clientX - startX))))
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const toggle = (level: number) => setExpanded(p => ({ ...p, [level]: !p[level] }))
  const toggleMore = (level: number) => setShowMore(p => ({ ...p, [level]: !p[level] }))
  const toggleAnswer = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenAnswer(prev => prev === key ? null : key)
  }

  if (!open) return (
    <aside className="sidebar-left" style={{
      width: 40, flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 8,
    }}>
      <button
        onClick={onToggle}
        title="Expand sidebar"
        style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      </button>
    </aside>
  )

  return (
    <aside className="sidebar-left" style={{
      width, flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Drag handle */}
      <div onMouseDown={onMouseDown} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />
      {/* Header */}
      <div style={{
        padding: '16px 14px 12px',
        fontSize: 11, fontWeight: 600, letterSpacing: '1px',
        color: 'var(--text-secondary)', textTransform: 'uppercase',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Example Questions</span>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
      </div>

      {LEVELS.map(({ level, description, items }) => {
        const isOpen = expanded[level] ?? false
        const isMore = showMore[level] ?? false
        const visible = isMore ? items : items.slice(0, SHOW_INITIAL)

        return (
          <div key={level} style={{ borderBottom: '1px solid var(--border-color)' }}>
            {/* Section header */}
            <button
              onClick={() => toggle(level)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 8,
                padding: '12px 14px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-card)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                  L{level} · {items.length} questions
                </div>
              </div>
              <Chevron open={isOpen} />
            </button>

            {isOpen && (
              <div>
                {visible.map((item, i) => {
                  const key = `${level}-${i}`
                  const answerOpen = openAnswer === key
                  return (
                    <div key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        {/* Question button */}
                        <button
                          onClick={() => onSelect(item.question)}
                          style={{
                            flex: 1, textAlign: 'left',
                            padding: '10px 8px 10px 14px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-card)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {item.question}
                        </button>
                        {/* Answer toggle */}
                        <button
                          onClick={e => toggleAnswer(key, e)}
                          title={answerOpen ? 'Hide expected answer' : 'Show expected answer'}
                          style={{
                            flexShrink: 0, width: 24, height: 24,
                            margin: '6px 8px 0 0',
                            borderRadius: 'var(--r-sm)',
                            border: `1px solid ${answerOpen ? 'var(--primary)' : 'var(--border-color)'}`,
                            background: answerOpen ? 'var(--primary)' : 'none',
                            color: answerOpen ? 'var(--on-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Chevron open={answerOpen} />
                        </button>
                      </div>

                      {answerOpen && (
                        <div style={{
                          margin: '0 14px 12px 14px',
                          paddingLeft: 10,
                          borderLeft: '1px solid var(--border-color)',
                          fontSize: 12, color: 'var(--text-secondary)',
                          lineHeight: 1.65,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                            Expected
                          </span>
                          {item.answer}
                        </div>
                      )}
                    </div>
                  )
                })}

                {items.length > SHOW_INITIAL && (
                  <button
                    onClick={() => toggleMore(level)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      width: '100%', padding: '8px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--primary)',
                      borderTop: '1px solid var(--border-color)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-card)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Chevron open={isMore} />
                    {isMore ? 'Show less' : `${items.length - SHOW_INITIAL} more`}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}
