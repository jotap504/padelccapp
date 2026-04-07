'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface Statistics {
  total_players: number
  total_matches: number
  active_players: number
  average_rating: number
  category_distribution: { [key: string]: number }
  matches_per_category: { [key: string]: number }
}

const categories = [
  { number: 1, name: '1ra' },
  { number: 2, name: '2da' },
  { number: 3, name: '3ra' },
  { number: 4, name: '4ta' },
  { number: 5, name: '5ta' },
  { number: 6, name: '6ta' },
  { number: 7, name: '7ma' },
  { number: 8, name: '8va' }
]

export default function RankingsStatisticsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return
    loadStatistics()
  }, [isLoading, isAuthenticated])

  async function loadStatistics() {
    try {
      // Obtener estadísticas básicas
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('rating, total_matches, win_rate')
        .not('role', 'eq', 'admin')

      if (usersError) throw usersError

      // Obtener partidos
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('player1_id, player2_id, player3_id, player4_id, status')
        .eq('status', 'completed')

      if (matchesError) throw matchesError

      // Calcular estadísticas
      const totalPlayers = users?.length || 0
      const activePlayers = users?.filter(u => u.total_matches > 0).length || 0
      const averageRating = users?.reduce((sum, u) => sum + (u.rating || 0), 0) / (totalPlayers || 1)
      const totalMatches = matches?.length || 0

      // Distribución por categoría (basado en rating)
      const categoryDistribution: { [key: string]: number } = {}
      const categoryRanges = [
        { name: '1ra', min: 1500, max: 9999 },
        { name: '2da', min: 1300, max: 1499 },
        { name: '3ra', min: 1150, max: 1299 },
        { name: '4ta', min: 1000, max: 1149 },
        { name: '5ta', min: 875, max: 999 },
        { name: '6ta', min: 750, max: 874 },
        { name: '7ma', min: 600, max: 749 },
        { name: '8va', min: 0, max: 599 }
      ]

      categoryRanges.forEach(range => {
        const count = users?.filter(u => 
          (u.rating || 0) >= range.min && (u.rating || 0) <= range.max
        ).length || 0
        categoryDistribution[range.name] = count
      })

      // Partidos por categoría (estimado)
      const matchesPerCategory: { [key: string]: number } = {}
      categoryRanges.forEach(range => {
        const playersInCategory = users?.filter(u => 
          (u.rating || 0) >= range.min && (u.rating || 0) <= range.max
        ) || []
        // Estimación simple: partidos totales * proporción de jugadores en categoría
        matchesPerCategory[range.name] = Math.round((totalMatches * playersInCategory.length) / (totalPlayers || 1))
      })

      setStatistics({
        total_players: totalPlayers,
        total_matches: totalMatches,
        active_players: activePlayers,
        average_rating: Math.round(averageRating),
        category_distribution: categoryDistribution,
        matches_per_category: matchesPerCategory
      })
    } catch (error) {
      console.error('Error loading statistics:', error)
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

  if (!statistics) {
    return (
      <MainLayout>
        <div className="text-center text-gray-400">
          No se pudieron cargar las estadísticas
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">📊 Estadísticas del Club</h1>
          <p className="text-blue-100">Análisis detallado del rendimiento y distribución</p>
        </div>

        {/* Main Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-blue-400">{statistics.total_players}</div>
            <div className="text-sm text-gray-400 mt-1">Total de Jugadores</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-green-400">{statistics.total_matches}</div>
            <div className="text-sm text-gray-400 mt-1">Partidos Jugados</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-purple-400">{statistics.active_players}</div>
            <div className="text-sm text-gray-400 mt-1">Jugadores Activos</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-orange-400">{statistics.average_rating}</div>
            <div className="text-sm text-gray-400 mt-1">Rating Promedio</div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Distribución por Categoría</h2>
          <div className="space-y-4">
            {categories.map(category => {
              const playerCount = statistics.category_distribution[category.name] || 0
              const matchCount = statistics.matches_per_category[category.name] || 0
              const percentage = statistics.total_players > 0 ? (playerCount / statistics.total_players * 100).toFixed(1) : '0'
              
              return (
                <div key={category.number} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-lg text-sm font-bold ${
                      category.number <= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                      category.number <= 4 ? 'bg-blue-500/20 text-blue-400' :
                      category.number <= 6 ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {category.name}
                    </div>
                    <div className="text-gray-300">
                      <span className="font-bold">{playerCount}</span> jugadores
                      <span className="text-gray-500 ml-2">({percentage}%)</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <span className="font-bold">{matchCount}</span> partidos
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Metrics */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Métricas de Actividad</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {statistics.total_players > 0 ? ((statistics.active_players / statistics.total_players) * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-sm text-gray-400 mt-1">Tasa de Actividad</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {statistics.active_players > 0 ? Math.round(statistics.total_matches / statistics.active_players) : '0'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Partidos por Jugador Activo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {statistics.total_players > 0 ? Math.round(statistics.total_matches / statistics.total_players) : '0'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Partidos por Jugador Total</div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
