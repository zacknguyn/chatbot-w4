import l1 from './L1_questions.json'
import l2 from './L2_questions.json'
import l3 from './L3_questions.json'
import l4 from './L4_conversation_scripts.json'
import l5 from './L5_investigation_prompts.json'

export interface QA {
  question: string
  answer: string
}

export interface LevelSection {
  level: number
  description: string
  items: QA[]
}

function extractItems(raw: Record<string, unknown>): QA[] {
  if (Array.isArray(raw.questions))
    return (raw.questions as Array<{ question: string; expected_answer: string }>)
      .map(q => ({ question: q.question, answer: q.expected_answer }))
  if (Array.isArray(raw.conversations))
    return (raw.conversations as Array<{ turns: Array<{ user: string; expected_answer: string }> }>)
      .map(c => ({ question: c.turns[0].user, answer: c.turns[0].expected_answer }))
  if (Array.isArray(raw.investigations))
    return (raw.investigations as Array<{ prompt: string; expected_findings: string }>)
      .map(i => ({ question: i.prompt, answer: i.expected_findings }))
  return []
}

export const LEVELS: LevelSection[] = [l1, l2, l3, l4, l5].map(raw => ({
  level: raw.level as number,
  description: raw.description as string,
  items: extractItems(raw as Record<string, unknown>),
}))
