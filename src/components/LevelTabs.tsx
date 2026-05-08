const TABS = [
  { label: 'Auto', value: 0, desc: 'Let the agent decide' },
  { label: 'L1', value: 1, desc: 'Single-Fact' },
  { label: 'L2', value: 2, desc: 'Multi-Source' },
  { label: 'L3', value: 3, desc: 'Tools + Memory' },
  { label: 'L4', value: 4, desc: 'Conversational' },
  { label: 'L5', value: 5, desc: 'Investigation' },
]

interface Props { level: number; onChange: (level: number) => void }

export default function LevelTabs({ level, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {TABS.map(tab => {
        const isActive = tab.value === level
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            title={tab.desc}
            style={{
              padding: '3px 9px',
              borderRadius: 'var(--r-pill)',
              border: isActive ? 'none' : '1px solid var(--border-color)',
              background: isActive ? 'var(--primary)' : 'transparent',
              color: isActive ? 'var(--on-primary)' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: isActive ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
