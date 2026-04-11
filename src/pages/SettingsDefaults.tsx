import { Clock, Dumbbell } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import PageHeader from '@/components/PageHeader'

export default function SettingsDefaults() {
  const { settings, update } = useSettingsStore()

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title="Defaults" back />

      <div className="space-y-4">
        {/* Weight unit */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Dumbbell size={18} className="text-brand-400" />
            <span className="font-semibold">Default Weight Unit</span>
          </div>
          <div className="flex gap-3">
            {(['kg', 'lbs'] as const).map(unit => (
              <button
                key={unit}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition ${
                  settings.defaultWeightUnit === unit
                    ? 'bg-brand-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => update('defaultWeightUnit', unit)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>

        {/* Default rest */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Clock size={18} className="text-brand-400" />
            <span className="font-semibold">Default Rest</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultRestSeconds', Math.max(0, (settings.defaultRestSeconds ?? 120) - 15))}
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-3xl font-bold tabular-nums">
                {settings.defaultRestSeconds === 0 ? 'None' : `${settings.defaultRestSeconds ?? 120}s`}
              </p>
            </div>
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultRestSeconds', (settings.defaultRestSeconds ?? 120) + 15)}
            >+</button>
          </div>
          <div className="flex gap-2">
            {[0, 60, 90, 120, 180].map(s => (
              <button
                key={s}
                className={`flex-1 py-1.5 rounded-lg font-medium text-xs transition ${
                  settings.defaultRestSeconds === s
                    ? 'bg-brand-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                onClick={() => update('defaultRestSeconds', s)}
              >
                {s === 0 ? 'None' : `${s}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Default sets per row */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Dumbbell size={18} className="text-brand-400" />
            <span className="font-semibold">Default Sets Per Row</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultSetRowCount', Math.max(1, (settings.defaultSetRowCount ?? 3) - 1))}
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-3xl font-bold tabular-nums">{settings.defaultSetRowCount ?? 3}</p>
            </div>
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultSetRowCount', (settings.defaultSetRowCount ?? 3) + 1)}
            >+</button>
          </div>
        </div>
      </div>
    </div>
  )
}
