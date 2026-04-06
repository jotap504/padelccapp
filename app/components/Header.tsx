'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'

interface HeaderProps {
  title?: string
  showBack?: boolean
  backUrl?: string
}

export default function Header({ title, showBack, backUrl }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadUnreadCount()
      
      // Subscribe to new notifications
      const subscription = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadUnreadCount()
        })
        .subscribe()
      
      return () => {
        subscription.unsubscribe()
      }
    }
  }, [user?.id])

  async function loadUnreadCount() {
    if (!user?.id) return
    
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    
    setUnreadCount(count || 0)
    
    // Load recent notifications
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (data) setRecentNotifications(data)
  }

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    
    loadUnreadCount()
  }

  const getNotificationIcon = (type: string): string => {
    const icons: Record<string, string> = {
      match_created: '🎾',
      match_validation_needed: '✓',
      match_confirmed: '✅',
      tournament_registration: '🏆',
      ranking_changed: '📈',
      general: '📢'
    }
    return icons[type] || '📢'
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/matches', label: 'Partidos', icon: '🎾' },
    { href: '/ranking', label: 'Ranking', icon: '🏆' },
    { href: '/tournaments', label: 'Torneos', icon: '🏅' },
    { href: '/leagues', label: 'Ligas', icon: '🏆' },
    { href: '/intercountry', label: 'Intercountry', icon: '🌐' },
    { href: '/courts', label: 'Canchas', icon: '🏟️' },
    { href: '/availability', label: 'Disponibilidad', icon: '📅' },
    { href: '/chat', label: 'Chat', icon: '💬' },
    { href: '/compare', label: 'Comparar', icon: '⚖️' },
  ]

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Left: Logo & Title */}
          <div className="flex items-center space-x-4">
            {showBack && (
              <button 
                onClick={() => backUrl ? router.push(backUrl) : router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl">🎾</span>
              <h1 className="text-xl font-bold text-gray-900">PádelCC</h1>
            </Link>
            {title && (
              <span className="text-gray-400">|</span>
            )}
            {title && (
              <h2 className="text-lg font-medium text-gray-700 hidden sm:block">{title}</h2>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right: Notifications & User */}
          <div className="flex items-center space-x-4">
            {/* Notifications Bell */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="relative p-2 text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-20">
                      <div className="p-3 border-b">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold">Notificaciones</h3>
                          {unreadCount > 0 && (
                            <Link 
                              href="/notifications"
                              className="text-sm text-blue-600 hover:underline"
                              onClick={() => setShowDropdown(false)}
                            >
                              Ver todas
                            </Link>
                          )}
                        </div>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto">
                        {recentNotifications.length > 0 ? (
                          recentNotifications.map((notification) => (
                            <div
                              key={notification.id}
                              className="p-3 border-b hover:bg-gray-50 cursor-pointer"
                              onClick={() => {
                                markAsRead(notification.id)
                                if (notification.action_url) {
                                  router.push(notification.action_url)
                                }
                                setShowDropdown(false)
                              }}
                            >
                              <div className="flex items-start space-x-3">
                                <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-gray-500 line-clamp-2">
                                    {notification.message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-8 text-sm">
                            No tienes notificaciones nuevas
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <Link 
                  href={`/players/${user?.id}`}
                  className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg p-2"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    {user?.name?.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden lg:block">{user?.name}</span>
                </Link>
                <Link 
                  href="/admin/import"
                  className="text-sm text-gray-500 hover:text-gray-700 hidden sm:block"
                >
                  Admin
                </Link>
                <button 
                  onClick={() => {
                    localStorage.clear()
                    router.push('/login')
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link 
                href="/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Ingresar
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMobileMenu(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
