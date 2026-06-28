// components/layout/Navbar.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarDays, Table2,
  LogOut, LogIn, Menu, X, Shield
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCalendarData'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/',          label: 'Planning',   icon: Table2 },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, isAdmin } = useCurrentUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 bg-blue-800 text-white shadow-lg landscape:max-[900px]:hidden">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Image src="/logo.png" alt="Quercy Garonne Basketball" width={36} height={36} className="rounded" />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-white text-sm font-bold">Quercy Garonne</span>
              <span className="text-blue-300 text-[10px] font-normal">Calendrier Général</span>
            </div>
          </Link>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-white/20 text-white'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-orange-500 text-white'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                )}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            {profile ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Connexion
              </Link>
            )}
          </div>

          {/* Burger mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <div className="md:hidden border-t border-blue-700 py-2 space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
                  pathname === href
                    ? 'bg-white/20 text-white'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-orange-300 hover:bg-white/10"
              >
                <Shield className="w-4 h-4" />
                Administration
              </Link>
            )}
            {profile ? (
              <button
                onClick={() => { handleLogout(); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/10"
              >
                <LogIn className="w-4 h-4" />
                Connexion
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
