'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  is_important: boolean
  created_at: string
  action_url: string | null
  action_text: string | null
  data: any
}

const NOTIFICATION_ICONS: Record<string, string> = {
  match_created: '🎾',
  match_validation_needed: '✓',
  match_confirmed: '✅',
  tournament_registration: '🏆',
  tournament_starting: '⏰',
  ranking_changed: '📈',
  availability_match: '🤝',
  intercountry_match: '🌐',
  general: '📢'
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadNotifications()
  }, [isLoading, isAuthenticated])

  async function loadNotifications() {
    if (!user) return
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (filter === 'unread') {
      query = query.eq('is_read', false)
    }
    
    const { data } = await query
    
    if (data) setNotifications(data)
    setLoading(false)
  }

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    
    if (!error) {
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ))
    }
  }

  async function markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user?.id)
      .eq('is_read', false)
    
    if (!error) {
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    }
  }

  function getNotificationColor(type: string): string {
    const colors: Record<string, string> = {
      match_created: 'bg-blue-100 text-blue-800',
      match_validation_needed: 'bg-yellow-100 text-yellow-800',
      match_confirmed: 'bg-green-100 text-green-800',
      tournament_registration: 'bg-purple-100 text-purple-800',
      tournament_starting: 'bg-orange-100 text-orange-800',
      ranking_changed: 'bg-pink-100 text-pink-800',
      availability_match: 'bg-cyan-100 text-cyan-800',
      intercountry_match: 'bg-indigo-100 text-indigo-800',
      general: 'bg-gray-100 text-gray-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Notificaciones" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Notificaciones" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => { setFilter('all'); loadNotifications(); }}
            className={`px-4 py-2 rounded ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => { setFilter('unread'); loadNotifications(); }}
            className={`px-4 py-2 rounded ${
              filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            No leídas ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  notification.is_read 
                    ? 'bg-white border-gray-200' 
                    : 'bg-blue-50 border-blue-200'
                } ${notification.is_important ? 'border-l-4 border-l-red-500' : ''}`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${getNotificationColor(notification.type)}`}>
                    {NOTIFICATION_ICONS[notification.type] || '📢'}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-semibold ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {new Date(notification.created_at).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className={`mt-1 ${notification.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                      {notification.message}
                    </p>
                    <div className="mt-3 flex space-x-3">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Marcar como leída
                        </button>
                      )}
                      {notification.action_url && (
                        <button
                          onClick={() => {
                            const url = notification.action_url as string
                            markAsRead(notification.id)
                            router.push(url)
                          }}
                          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        >
                          {notification.action_text || 'Ver'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-gray-500">No tienes notificaciones {filter === 'unread' ? 'no leídas' : ''}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
