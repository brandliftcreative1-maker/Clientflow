'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Mail,
  Megaphone,
  Star,
  Wand2,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/sequences', label: 'Sequences', icon: Mail },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/reviews', label: 'Review Requests', icon: Star },
  { href: '/dashboard/ai-writer', label: 'AI Email Writer', icon: Wand2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-blue-600">ClientFlow</h1>
        <p className="text-xs text-gray-400 mt-0.5">Marketing automation</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-gray-100">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
