'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

interface NavItem {
  id: string
  label: string
  icon: string
  href?: string
  children?: NavItem[]
  adminOnly?: boolean
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const [expandedSections, setExpandedSections] = useState<string[]>(['matches'])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const navigation: NavItem[] = [
    {
      id: 'matches',
      label: 'Partidos',
      icon: '🏓',
      children: [
        { id: 'my-matches', label: 'Mis Partidos', href: '/matches', icon: '�' },
        { id: 'create-match', label: 'Crear Partido', href: '/matches?create=true', icon: '➕' }
      ]
    },
    {
      id: 'tournaments',
      label: 'Torneos',
      icon: '🏆',
      children: [
        { id: 'internal', label: 'Torneos Internos', href: '/tournaments', icon: '🎯' },
        { id: 'leagues', label: 'Ligas', href: '/leagues', icon: '🏅' },
        { id: 'intercountry', label: 'Intercountry', href: '/intercountry', icon: '🌍' }
      ]
    },
    {
      id: 'teams',
      label: 'Equipos',
      icon: '👥',
      children: [
        { id: 'roster', label: 'Plantilla', href: '/teams/roster', icon: '📋' },
        { id: 'goodstanding', label: 'Lista de Buena Fe', href: '/teams/good-standing', icon: '✅' }
      ]
    },
    {
      id: 'rankings',
      label: 'Rankings',
      icon: '📊',
      children: [
        { id: 'general', label: 'Ranking General', href: '/rankings', icon: '🏆' },
        { id: 'statistics', label: 'Estadísticas', href: '/rankings/statistics', icon: '📈' }
      ]
    },
    ...(user?.role === 'admin' || user?.role === 'superadmin' ? [
      {
        id: 'admin',
        label: 'Administración',
        icon: '⚙️',
        adminOnly: true,
        children: [
          { id: 'points', label: 'Sistema de Puntos', href: '/admin/ranking', icon: '�' },
          { id: 'courts', label: 'Gestión de Canchas', href: '/admin/courts', icon: '🏟️' },
          { id: 'import', label: 'Importar Datos', href: '/admin/import', icon: '📥' }
        ]
      }
    ] : [])
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-gray-100">
      {/* Mobile Header */}
      <header className={`lg:hidden fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-gray-900/95 backdrop-blur-md shadow-lg' : 'bg-gray-900'
      }`}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              PadelCC
            </span>
          </Link>
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-72 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <span className="font-bold text-xl bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                PadelCC
              </span>
              <p className="text-xs text-gray-500">Sistema de Gestión</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-140px)]">
          {navigation.map((section) => (
            <div key={section.id}>
              {section.href ? (
                <Link
                  href={section.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive(section.href)
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{section.icon}</span>
                  <span className="font-medium">{section.label}</span>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{section.icon}</span>
                      <span className="font-medium">{section.label}</span>
                    </div>
                    <svg 
                      className={`w-5 h-5 transition-transform duration-200 ${
                        expandedSections.includes(section.id) ? 'rotate-180' : ''
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedSections.includes(section.id) && (
                    <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-700 pl-4">
                      {section.children?.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href || '#'}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                            item.href && isActive(item.href)
                              ? 'bg-gray-800 text-blue-400 border-l-2 border-blue-400'
                              : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-gray-900">
          <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.name || 'Usuario'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
