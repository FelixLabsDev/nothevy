import Anthropic from '@anthropic-ai/sdk'
import type { WorkoutTemplate, WorkoutSession } from '@/types'
import { nanoid } from '@/lib/workout'

// ---------------------------------------------------------------------------
// Claude client — instantiated lazily with user-supplied API key
// ---------------------------------------------------------------------------
function getClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// ---------------------------------------------------------------------------
// Generate a WorkoutTemplate from a plain-text user goal
// ---------------------------------------------------------------------------
export async function generateTemplate(
  goal: string,
  apiKey: string
): Promise<WorkoutTemplate> {
  const client = getClient(apiKey)

  const systemPrompt = `You are a professional personal trainer. 
When asked to create a workout, respond ONLY with a valid JSON object matching this TypeScript type:
{
  name: string,
  description: string,
  tags: string[],
  estimatedMinutes: number,
  slots: Array<{
    exerciseId: string,      // use a slug like "barbell_bench_press"
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

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Create a workout for: ${goal}` }]
  })

  const raw = (response.content[0] as { text: string }).text.trim()
  const parsed = JSON.parse(raw)

  // Hydrate IDs so the template is immediately usable
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
// In-session coach — get real-time advice based on current session state
// ---------------------------------------------------------------------------
export async function getSessionCoaching(
  session: WorkoutSession,
  apiKey: string
): Promise<string> {
  const client = getClient(apiKey)

  const summary = JSON.stringify({
    name: session.name,
    elapsed: Math.round((Date.now() - session.startedAt) / 60000) + ' min',
    slots: session.slots.map(slot => ({
      exerciseId: slot.exerciseId,
      setsCompleted: slot.sets.filter(s => s.completedAt).length,
      totalSets: slot.sets.length
    }))
  })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `I am currently doing this workout session: ${summary}. Give me a brief (2-3 sentence) motivational tip or form cue for what I should focus on right now.`
    }]
  })

  return (response.content[0] as { text: string }).text.trim()
}

// ---------------------------------------------------------------------------
// Weekly insight — summarise last N sessions and flag patterns
// ---------------------------------------------------------------------------
export async function getWeeklyInsight(
  sessions: WorkoutSession[],
  apiKey: string
): Promise<string> {
  const client = getClient(apiKey)

  const summary = sessions.map(s => ({
    name: s.name,
    date: new Date(s.startedAt).toDateString(),
    volumeKg: s.totalVolumeKg,
    duration: s.completedAt ? Math.round((s.completedAt - s.startedAt) / 60000) + ' min' : 'incomplete'
  }))

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Here are my last ${sessions.length} workout sessions: ${JSON.stringify(summary)}. 
Provide a concise insight (3-4 sentences): overall trend, any imbalances or plateaus you notice, and one actionable recommendation.`
    }]
  })

  return (response.content[0] as { text: string }).text.trim()
}
