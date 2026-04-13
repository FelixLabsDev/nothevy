import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, ClipboardList, History, Settings, FileText } from 'lucide-react'

const tabs = [
  { to: '/',          label: 'Home',      Icon: LayoutDashboard },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { to: '/templates', label: 'Templates', Icon: ClipboardList },
  { to: '/history',   label: 'History',   Icon: History },
  { to: '/docs',      label: 'Docs',      Icon: FileText },
  { to: '/settings',  label: 'Settings',  Icon: Settings }
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg
                    backdrop-blur border-t pb-safe z-50"
         style={{ backgroundColor: 'var(--bg-nav)', borderColor: 'var(--border)' }}>
      <div className="flex justify-around">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-[11px]">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
