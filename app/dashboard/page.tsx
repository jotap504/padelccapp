'use client'

import { useAuth } from '@/lib/auth/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import MainLayout from '@/app/components/MainLayout'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

interface DashboardStats {
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  rating: number
  pendingValidations: number
}

interface Match {
  id: string
  date: string
  sets: Array<{
    games_a: number
    games_b: number
  }>
  team_a: Array<{
    user_id: string
    name: string
  }>
  team_b: Array<{
    user_id: string
    name: string
  }>
  status: string
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    rating: 0,
    pendingValidations: 0
  })
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadDashboardData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadDashboardData() {
    if (!user) return
    
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('rating, total_matches, win_rate')
        .eq('id', user.id)
        .single()
      
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .or(`team_a.cs.{"user_id":"${user.id}"},team_b.cs.{"user_id":"${user.id}"}`)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(5)
      
      const { data: pendingData } = await supabase
        .from('matches')
        .select('*')
        .or(`team_a.cs.{"user_id":"${user.id}"},team_b.cs.{"user_id":"${user.id}"}`)
        .eq('status', 'pending')
        .not('validated_by', 'cs', `{${user.id}}`)
      
      if (matchesData) {
        const wins = matchesData.filter(m => {
          const inTeamA = m.team_a?.some((p: any) => p.user_id === user.id)
          const setsA = m.sets?.filter((s: any) => s.games_a > s.games_b).length || 0
          const setsB = m.sets?.filter((s: any) => s.games_b > s.games_a).length || 0
          return (inTeamA && setsA > setsB) || (!inTeamA && setsB > setsA)
        }).length
        
        setStats({
          totalMatches: userData?.total_matches || 0,
          wins: wins,
          losses: (matchesData?.length || 0) - wins,
          winRate: userData?.win_rate || 0,
          rating: userData?.rating || 1500,
          pendingValidations: pendingData?.length || 0
        })
        
        setRecentMatches(matchesData.slice(0, 5))
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    )
  }

  const statCards = [
    { label: 'Partidos', value: stats.totalMatches, icon: '🏓', color: 'from-blue-500 to-blue-700', bgColor: 'bg-blue-500/10' },
    { label: 'Victorias', value: stats.wins, icon: '👏', color: 'from-green-500 to-green-700', bgColor: 'bg-green-500/10' },
    { label: 'Derrotas', value: stats.losses, icon: '😐', color: 'from-red-500 to-red-700', bgColor: 'bg-red-500/10' },
    { label: '% Victoria', value: `${stats.winRate}%`, icon: '📈', color: 'from-orange-500 to-orange-700', bgColor: 'bg-orange-500/10' },
    { label: 'Pendientes', value: stats.pendingValidations, icon: '🕒', color: 'from-purple-500 to-purple-700', bgColor: 'bg-purple-500/10' },
  ]

  const quickActions = [
    { href: '/matches?create=true', icon: '➕', title: 'Crear Partido', subtitle: 'Nuevo partido ahora', highlight: true },
    { href: '/matches', icon: '🏓', title: 'Mis Partidos', subtitle: 'Historial y resultados', highlight: false },
    { href: '/rankings', icon: '📊', title: 'Ver Ranking', subtitle: 'Estadísticas', highlight: false },
    { href: '/tournaments', icon: '🏆', title: 'Torneos', subtitle: 'Competiciones', highlight: false },
    { href: '/availability', icon: '🕒', title: 'Disponibilidad', subtitle: 'Marcar horarios', highlight: false },
    { href: '/compare', icon: '📈', title: 'Comparar', subtitle: 'Vs otros jugadores', highlight: false },
  ]

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              ¡Hola, {user?.name}! 👋
            </h1>
            <p className="text-blue-100 text-lg">
              Bienvenido a tu panel de control. Gestiona tus partidos y estadísticas.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((stat, index) => (
            <div 
              key={index} 
              className="group relative overflow-hidden rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6 hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500`}></div>
              <div className="relative z-10">
                <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <p className="text-gray-400 text-sm font-medium mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚡</span> Acciones Rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <Link 
                key={index}
                href={action.href}
                className={`group relative overflow-hidden rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] ${
                  action.highlight 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40' 
                    : 'bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    action.highlight ? 'bg-white/20' : 'bg-gray-700 group-hover:bg-gray-600'
                  } transition-colors`}>
                    {action.icon}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${action.highlight ? 'text-white' : 'text-gray-100'}`}>
                      {action.title}
                    </h3>
                    <p className={`text-sm ${action.highlight ? 'text-blue-100' : 'text-gray-400'}`}>
                      {action.subtitle}
                    </p>
                  </div>
                </div>
                {action.highlight && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📅</span> Actividad Reciente
          </h2>
          <div className="space-y-3">
            {recentMatches.length > 0 ? (
              recentMatches.map((match) => {
                const inTeamA = match.team_a?.some((p: any) => p.user_id === user?.id)
                const setsA = match.sets?.filter((s: any) => s.games_a > s.games_b).length || 0
                const setsB = match.sets?.filter((s: any) => s.games_b > s.games_a).length || 0
                const won = (inTeamA && setsA > setsB) || (!inTeamA && setsB > setsA)
                
                return (
                  <div 
                    key={match.id} 
                    className={`relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.02] ${
                      won 
                        ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/20' 
                        : 'bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/20'
                    }`}
                  >
                    {/* Indicador visual elegante para victoria */}
                    {won && (
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 opacity-20 rounded-full -mr-10 -mt-10 animate-pulse"></div>
                    )}
                    
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${
                          won 
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30' 
                            : 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30'
                        }`}>
                          {won ? '🏆' : '🎯'}
                          {/* Efecto de brillo para victorias */}
                          {won && (
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/30 to-transparent animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium flex items-center gap-2">
                            {new Date(match.date).toLocaleDateString('es-AR')}
                            {won && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-semibold shadow-md">
                                Victoria
                              </span>
                            )}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {match.sets?.map((s: any) => `${s.games_a}-${s.games_b}`).join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${
                        won 
                          ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {won ? '✓ Ganaste' : '✗ Perdiste'}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">🏓</p>
                <p>No hay partidos recientes</p>
                <p className="text-sm mt-1">¡Crea tu primer partido!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
