import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle, SkipForward, Timer, TrendingUp, MessageSquare, X } from 'lucide-react'
import { db } from '@/db'
import { useActiveSessionStore } from '@/stores/sessionStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getProgressionSuggestion } from '@/lib/workout'
import { getSessionCoaching } from '@/lib/ai'
import type { Exercise, PerformedSet } from '@/types'

// Format seconds as MM:SS
function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ActiveSession() {
  const navigate = useNavigate()
  const { settings } = useSettingsStore()
  const {
    session, currentSlotIndex, currentSetIndex,
    restSecondsRemaining, restTimerActive,
    completeSet, skipSet, selectVariation, advanceCursor,
    startRestTimer, tickRestTimer, stopRestTimer, adjustRestTimer,
    endSession, clearSession, newPRExerciseIds
  } = useActiveSessionStore()

  // Local input values for current set
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [duration, setDuration] = useState('')

  // In-session coach state
  const [coachMsg, setCoachMsg] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [timedCountdown, setTimedCountdown] = useState<number | null>(null)

  // Rest timer interval
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Timed set countdown interval
  const timedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Redirect if no active session
  useEffect(() => { if (!session) navigate('/') }, [session, navigate])

  // Sync rest timer tick
  useEffect(() => {
    if (restTimerActive) {
      restIntervalRef.current = setInterval(() => tickRestTimer(), 1000)
    } else {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current)
    }
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current) }
  }, [restTimerActive])

  if (!session) return null

  const currentSlot = session.slots[currentSlotIndex]
  const currentSet = currentSlot?.sets[currentSetIndex]

  // Fetch exercise name for display
  const AllExerciseIds = [...new Set(session.slots.map(s => s.exerciseId))]

  // Resolve exercise data eagerly via a ref-style cache
  const exerciseCache = useRef<Record<string, Exercise>>({})
  useLiveQuery(async () => {
    const exs = await db.exercises.bulkGet(AllExerciseIds)
    exs.forEach(e => { if (e) exerciseCache.current[e.id] = e })
  }, [AllExerciseIds.join(',')])

  const exName = (id: string) => exerciseCache.current[id]?.name ?? id
  const exVariations = (id: string) => exerciseCache.current[id]?.variations ?? []

  // Progressive overload suggestion for current exercise
  const [suggestion, setSuggestion] = useState<{ weight: number; reps: number; unit: string } | null>(null)
  useEffect(() => {
    if (!currentSlot) return
    getProgressionSuggestion(currentSlot.exerciseId).then(setSuggestion)
  }, [currentSlot?.exerciseId])

  // Pre-fill inputs when cursor changes
  useEffect(() => {
    if (!currentSet) return
    setWeight(String(currentSet.actualWeight ?? currentSet.weight ?? ''))
    setReps(String(currentSet.actualReps ?? currentSet.reps ?? ''))
    setDuration(String(currentSet.actualDurationSeconds ?? currentSet.durationSeconds ?? ''))
  }, [currentSlotIndex, currentSetIndex])

  // Handle completing a set
  const handleComplete = (skipRest = false) => {
    if (!currentSet) return
    const updates: Partial<PerformedSet> = {
      actualWeight: weight ? +weight : undefined,
      actualReps: reps ? +reps : undefined,
      actualDurationSeconds: duration ? +duration : undefined,
    }
    completeSet(currentSlotIndex, currentSetIndex, updates)
    if (!skipRest) {
      const restSecs = currentSet.restSeconds ?? settings.defaultRestSeconds ?? 120
      if (restSecs > 0) startRestTimer(restSecs)
      else advanceCursor()
    } else {
      advanceCursor()
    }
  }

  const handleSkip = () => {
    skipSet(currentSlotIndex, currentSetIndex)
    advanceCursor()
  }

  // Start a timed set countdown
  const startTimedSet = () => {
    const secs = duration ? +duration : currentSet?.durationSeconds ?? 30
    setTimedCountdown(secs)
    timedIntervalRef.current = setInterval(() => {
      setTimedCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timedIntervalRef.current!)
          handleComplete()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  // Check if all sets in all slots are done
  const allDone = session.slots.every(slot => slot.sets.every(s => s.completedAt || s.skipped))

  // Finish and persist session
  const handleEnd = async () => {
    const sessionId = await endSession()
    navigate(sessionId ? `/session/${sessionId}` : '/')
  }

  // Get AI coaching tip for the current session
  const handleCoach = async () => {
    const apiKey = settings.aiApiKey
    if (!apiKey) { setCoachMsg('Add an API key in Settings to enable coaching.'); return }
    setCoachLoading(true)
    const config = { provider: settings.aiProvider ?? 'claude', apiKey, model: settings.aiModel }
    try {
      const msg = await getSessionCoaching(session, config)
      setCoachMsg(msg)
    } catch { setCoachMsg('Could not reach AI provider.') }
    setCoachLoading(false)
  }

  // Progress: how many sets completed out of total
  const totalSets = session.slots.reduce((a, s) => a + s.sets.length, 0)
  const doneSets = session.slots.reduce((a, s) => a + s.sets.filter(st => st.completedAt || st.skipped).length, 0)
  const progress = totalSets > 0 ? doneSets / totalSets : 0

  return (
    <div className="px-4 pb-24 pt-safe pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-brand-400 uppercase tracking-wide font-medium">In Progress</p>
          <h1 className="text-xl font-bold">{session.name}</h1>
        </div>
        <button className="btn-danger text-sm" onClick={handleEnd}>
          {allDone ? 'Finish' : 'End Early'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Rest timer */}
      {restTimerActive && (
        <div className="card mb-4 bg-slate-800/80 border-brand-700">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-brand-400 uppercase font-medium tracking-wide">Rest</p>
              <p className="text-3xl font-bold tabular-nums">{fmtTime(restSecondsRemaining)}</p>
            </div>
            <button className="btn-ghost text-sm" onClick={() => { stopRestTimer(); advanceCursor() }}>
              <SkipForward size={16} /> Skip
            </button>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1 text-sm py-1.5" onClick={() => adjustRestTimer(-15)}>−15s</button>
            <button className="btn-ghost flex-1 text-sm py-1.5" onClick={() => adjustRestTimer(+15)}>+15s</button>
          </div>
        </div>
      )}

      {/* New PR badges */}
      {newPRExerciseIds.length > 0 && (
        <div className="card mb-4 bg-yellow-900/30 border-yellow-700">
          <p className="text-yellow-400 font-semibold text-sm">🏆 New PRs: {newPRExerciseIds.map(id => exName(id)).join(', ')}</p>
        </div>
      )}

      {/* Current exercise */}
      {currentSlot && currentSet && !allDone && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Exercise {currentSlotIndex + 1} / {session.slots.length}
            </p>
            <p className="text-xs text-slate-500">Set {currentSetIndex + 1} / {currentSlot.sets.length}</p>
          </div>
          <h2 className="text-xl font-bold mb-1">
            {exName(currentSlot.exerciseId)}
            {currentSlot.selectedVariation && (
              <span className="text-brand-400 font-normal text-base"> — {currentSlot.selectedVariation}</span>
            )}
          </h2>
          {currentSlot.notes && <p className="text-xs text-slate-400 mb-2">{currentSlot.notes}</p>}

          {/* Variation picker */}
          {exVariations(currentSlot.exerciseId).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {exVariations(currentSlot.exerciseId).map(v => (
                <button
                  key={v}
                  onClick={() => selectVariation(currentSlotIndex, currentSlot.selectedVariation === v ? undefined : v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                    currentSlot.selectedVariation === v
                      ? 'bg-brand-700 border-brand-500 text-brand-100'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {/* Progressive overload suggestion */}
          {suggestion && (
            <div className="flex items-center gap-1.5 text-xs text-brand-400 mb-3">
              <TrendingUp size={13} />
              Last time: try {suggestion.weight}{suggestion.unit} × {suggestion.reps}
            </div>
          )}

          {/* Input fields */}
          {currentSet.type === 'timed' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Duration (sec)</label>
                <input className="input text-2xl font-bold text-center" type="number"
                  value={timedCountdown !== null ? timedCountdown : duration}
                  onChange={e => setDuration(e.target.value)} readOnly={timedCountdown !== null} />
              </div>
              {timedCountdown === null ? (
                <button className="btn-primary w-full" onClick={startTimedSet}>
                  <Timer size={18} /> Start Timer
                </button>
              ) : (
                <div className="text-center text-4xl font-bold tabular-nums text-brand-400">
                  {fmtTime(timedCountdown)}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Weight ({settings.defaultWeightUnit ?? 'kg'})</label>
                <input className="input text-xl font-bold text-center" type="number"
                  placeholder="0" value={weight} onChange={e => setWeight(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  {currentSet.type === 'failure' ? 'Reps (to failure)' : 'Reps'}
                </label>
                <input className="input text-xl font-bold text-center" type="number"
                  placeholder="0" value={reps} onChange={e => setReps(e.target.value)} />
              </div>
            </div>
          )}

          {/* Complete / Skip */}
          {currentSet.type !== 'timed' && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <button className="btn-ghost flex-1" onClick={handleSkip}>
                  <SkipForward size={16} /> Skip
                </button>
                <button className="btn-primary flex-1" onClick={() => handleComplete(false)}>
                  <CheckCircle size={18} /> Log Set
                </button>
              </div>
              <button
                className="btn-ghost w-full text-sm py-2 text-slate-400"
                onClick={() => handleComplete(true)}
              >
                Log (no rest)
              </button>
            </div>
          )}
        </div>
      )}

      {/* All sets done */}
      {allDone && (
        <div className="card text-center py-8 mb-4 bg-brand-900/20 border-brand-700">
          <CheckCircle size={40} className="mx-auto mb-2 text-brand-400" />
          <p className="font-bold text-xl mb-1">All sets done!</p>
          <p className="text-sm text-slate-400 mb-4">Tap Finish to save your session.</p>
          <button className="btn-primary px-8" onClick={handleEnd}>Finish Workout</button>
        </div>
      )}

      {/* Exercise overview list */}
      <div className="space-y-2">
        {session.slots.map((slot, si) => {
          const doneCount = slot.sets.filter(s => s.completedAt || s.skipped).length
          const isCurrent = si === currentSlotIndex
          return (
            <div key={slot.id} className={`card ${isCurrent ? 'border-brand-600' : ''}`}>
              <div className="flex items-center justify-between">
                <p className={`font-medium text-sm ${isCurrent ? 'text-brand-300' : 'text-slate-300'}`}>
                  {exName(slot.exerciseId) || 'Unknown'}
                  {slot.selectedVariation && (
                    <span className="text-slate-500 font-normal"> — {slot.selectedVariation}</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{doneCount}/{slot.sets.length} sets</p>
              </div>
              {/* Mini set indicators */}
              <div className="flex gap-1 mt-2">
                {slot.sets.map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-1.5 flex-1 rounded-full ${
                      s.skipped ? 'bg-slate-600' :
                      s.completedAt ? 'bg-brand-500' :
                      (si === currentSlotIndex && i === currentSetIndex) ? 'bg-brand-800 ring-1 ring-brand-400' :
                      'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Coach */}
      <div className="mt-4 card">
        <button
          className="flex items-center gap-2 text-sm text-brand-400 mb-2"
          onClick={handleCoach}
          disabled={coachLoading}
        >
          <MessageSquare size={16} />
          {coachLoading ? 'Asking AI…' : 'Get coaching tip'}
        </button>
        {coachMsg && <p className="text-sm text-slate-300 leading-relaxed">{coachMsg}</p>}
      </div>
    </div>
  )
}
