import { useState, useCallback } from 'react'
import { randomUUID } from './utils/uuid'
import './index.css'
import TopBar from './components/TopBar'
import LeftSidebar from './components/LeftSidebar'
import ChatShell from './components/ChatShell'
import RightSidebar, { type TraceEntry } from './components/RightSidebar'

export type FontFamily = 'Inter' | 'DM Sans' | 'IBM Plex Sans' | 'Lora' | 'Source Serif 4'
export type FontSize = 'sm' | 'md' | 'lg'

export default function App() {
  const [dark, setDark] = useState(false)
  const [fontFamily, setFontFamily] = useState<FontFamily>('Inter')
  const [fontSize, setFontSize] = useState<FontSize>('md')
  const [level, setLevel] = useState(1)
  const [sessionId, setSessionId] = useState(() => randomUUID().slice(0, 8))
  const [resetKey, setResetKey] = useState(() => randomUUID())
  const [prefill, setPrefill] = useState('')
  const [traceHistory, setTraceHistory] = useState<TraceEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d)
      return !d
    })
  }

  const newChat = () => {
    setSessionId(randomUUID().slice(0, 8))
    setResetKey(randomUUID())
    setTraceHistory([])
    setLevel(1)
  }

  const handlePrefillConsumed = useCallback(() => setPrefill(''), [])
  const handleToolsUsed = useCallback((entry: TraceEntry) => {
    setTraceHistory(prev => [...prev, entry])
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      <TopBar
        sessionId={sessionId}
        dark={dark}
        busy={busy}
        fontFamily={fontFamily}
        fontSize={fontSize}
        onToggleDark={toggleDark}
        onNewChat={newChat}
        onFontFamilyChange={setFontFamily}
        onFontSizeChange={setFontSize}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftSidebar onSelect={setPrefill} open={leftOpen} onToggle={() => setLeftOpen(o => !o)} />
        <ChatShell
          level={level}
          onLevelChange={setLevel}
          sessionId={sessionId}
          fontFamily={fontFamily}
          fontSize={fontSize}
          prefill={prefill}
          onPrefillConsumed={handlePrefillConsumed}
          onToolsUsed={handleToolsUsed}
          onBusyChange={setBusy}
          resetKey={resetKey}
        />
        <RightSidebar history={traceHistory} open={rightOpen} onToggle={() => setRightOpen(o => !o)} />
      </div>
    </div>
  )
}
