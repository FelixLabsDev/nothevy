import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIProvider, WorkoutTemplate, WorkoutSession } from '@/types'
import { nanoid } from '@/lib/workout'

// ---------------------------------------------------------------------------
// Config passed from settings into every AI call
// ---------------------------------------------------------------------------
export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model?: string
}

// Default models per provider (capable = generation, fast = coaching/insight)
const DEFAULTS: Record<AIProvider, { fast: string; capable: string }> = {
  claude:      { capable: 'claude-opus-4-5',            fast: 'claude-haiku-4-5' },
  openai:      { capable: 'gpt-4o',                     fast: 'gpt-4o-mini' },
  openrouter:  { capable: 'anthropic/claude-opus-4-5',  fast: 'anthropic/claude-haiku-4-5' }
}

// ---------------------------------------------------------------------------
// Build a LangChain chat model from the user's AI config
// ---------------------------------------------------------------------------
function buildModel(config: AIConfig, tier: 'capable' | 'fast'): BaseChatModel {
  const model = config.model || DEFAULTS[config.provider][tier]

  if (config.provider === 'claude') {
    return new ChatAnthropic({ apiKey: config.apiKey, model, clientOptions: { dangerouslyAllowBrowser: true } })
  }

  // OpenAI and OpenRouter both use ChatOpenAI — only the base URL differs
  return new ChatOpenAI({
    apiKey: config.apiKey,
    model,
    configuration: config.provider === 'openrouter'
      ? {
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: { 'HTTP-Referer': 'https://nothevy.app', 'X-Title': 'NotHevy' },
          dangerouslyAllowBrowser: true
        }
      : { dangerouslyAllowBrowser: true }
  })
}

// ---------------------------------------------------------------------------
// Unified chat helper — returns the assistant's text response
// ---------------------------------------------------------------------------
async function chat(
  config: AIConfig,
  tier: 'capable' | 'fast',
  system: string,
  userMessage: string
): Promise<string> {
  const llm = buildModel(config, tier)
  const response = await llm.invoke([new SystemMessage(system), new HumanMessage(userMessage)])
  return typeof response.content === 'string' ? response.content.trim() : String(response.content)
}

// ---------------------------------------------------------------------------
// Generate a WorkoutTemplate from a plain-text user goal
// ---------------------------------------------------------------------------
export async function generateTemplate(goal: string, config: AIConfig): Promise<WorkoutTemplate> {
  const system = `You are a professional personal trainer.
When asked to create a workout, respond ONLY with a valid JSON object matching this TypeScript type:
{
  name: string,
  description: string,
  tags: string[],
  estimatedMinutes: number,
  slots: Array<{
    exerciseId: string,
    orderIndex: number,
    sets: Array<{
      type: "reps"|"timed"|"failure",
      reps?: number,
      durationSeconds?: number,
      weight?: number,
      weightUnit: "kg"|"lbs",
      restSeconds: number
    }>,
    notes?: string
  }>
}
No markdown, no explanation — pure JSON only.`

  const raw = await chat(config, 'capable', system, `Create a workout for: ${goal}`)

  // Strip accidental markdown fences before parsing
  const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(cleaned)

  const now = Date.now()
  return {
    id: nanoid(),
    name: parsed.name,
    description: parsed.description,
    tags: parsed.tags ?? [],
    estimatedMinutes: parsed.estimatedMinutes,
    createdAt: now,
    updatedAt: now,
    slots: (parsed.slots ?? []).map((slot: Record<string, unknown>, i: number) => ({
      id: nanoid(),
      exerciseId: slot.exerciseId as string,
      orderIndex: i,
      notes: slot.notes as string | undefined,
      sets: ((slot.sets as Record<string, unknown>[]) ?? []).map((s) => ({
        id: nanoid(),
        type: s.type,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        weight: s.weight,
        weightUnit: s.weightUnit ?? 'kg',
        restSeconds: s.restSeconds ?? 90
      }))
    }))
  }
}

// ---------------------------------------------------------------------------
// In-session coach — real-time advice based on current session state
// ---------------------------------------------------------------------------
export async function getSessionCoaching(session: WorkoutSession, config: AIConfig): Promise<string> {
  const summary = JSON.stringify({
    name: session.name,
    elapsed: Math.round((Date.now() - session.startedAt) / 60000) + ' min',
    slots: session.slots.map(slot => ({
      exerciseId: slot.exerciseId,
      setsCompleted: slot.sets.filter(s => s.completedAt).length,
      totalSets: slot.sets.length
    }))
  })
  return chat(
    config, 'fast',
    'You are a concise personal trainer giving real-time workout coaching.',
    `I am currently doing this workout session: ${summary}. Give me a brief (2-3 sentence) motivational tip or form cue for what I should focus on right now.`
  )
}

// ---------------------------------------------------------------------------
// Weekly insight — summarise last N sessions and flag patterns
// ---------------------------------------------------------------------------
export async function getWeeklyInsight(sessions: WorkoutSession[], config: AIConfig): Promise<string> {
  const summary = sessions.map(s => ({
    name: s.name,
    date: new Date(s.startedAt).toDateString(),
    volumeKg: s.totalVolumeKg,
    duration: s.completedAt ? Math.round((s.completedAt - s.startedAt) / 60000) + ' min' : 'incomplete'
  }))
  return chat(
    config, 'fast',
    'You are a fitness coach providing concise weekly performance insights.',
    `Here are my last ${sessions.length} workout sessions: ${JSON.stringify(summary)}. Provide a concise insight (3-4 sentences): overall trend, any imbalances or plateaus you notice, and one actionable recommendation.`
  )
}
