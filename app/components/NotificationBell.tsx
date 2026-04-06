'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface NotificationBellProps {
  userId: string
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])

  useEffect(() => {
    loadUnreadCount()
    
    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadUnreadCount()
      })
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [userId])

  async function loadUnreadCount() {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    
    setUnreadCount(count || 0)
    
    // Load recent notifications for dropdown
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
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

  return (
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
                  <span className="text-sm text-gray-500">{unreadCount} sin leer</span>
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
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.created_at).toLocaleDateString('es-AR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
            
            <div className="p-3 border-t">
              <button
                onClick={() => {
                  router.push('/notifications')
                  setShowDropdown(false)
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todas las notificaciones
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
