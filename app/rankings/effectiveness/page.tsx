'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface PlayerEffectiveness {
  player_id: string
  player_name: string
  club_id: string
  club_name: string
  current_category: number
  current_points: number
  total_matches: number
  total_wins: number
  effectiveness_rate: number
  category_rank: number
  overall_rank: number
  last_match_date: string
  activity_status: string
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

export default function EffectivenessRankingPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [rankings, setRankings] = useState<PlayerEffectiveness[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number>(0) // 0 = todas
  const [loading, setLoading] = useState(true)
  const [showOverall, setShowOverall] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return
    loadRankings()
  }, [isLoading, isAuthenticated])

  async function loadRankings() {
    try {
      const { data, error } = await supabase
        .from('player_effectiveness_ranking')
        .select('*')
        .order('effectiveness_rate', { ascending: false })

      if (error) throw error
      setRankings(data || [])
    } catch (error) {
      console.error('Error loading rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  function getCategoryName(category: number) {
    const cat = categories.find(c => c.number === category)
    return cat ? cat.name : `${category}ª`
  }

  function getActivityColor(status: string) {
    switch (status) {
      case 'Activo': return 'text-green-400'
      case 'Semi-activo': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  function getCategoryColor(category: number) {
    if (category <= 2) return 'bg-yellow-500/20 text-yellow-400'
    if (category <= 4) return 'bg-blue-500/20 text-blue-400'
    if (category <= 6) return 'bg-green-500/20 text-green-400'
    return 'bg-gray-500/20 text-gray-400'
  }

  function getEffectivenessColor(rate: number) {
    if (rate >= 70) return 'text-green-400'
    if (rate >= 60) return 'text-blue-400'
    if (rate >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const filteredRankings = selectedCategory === 0 
    ? rankings 
    : rankings.filter(r => r.current_category === selectedCategory)

  const displayRankings = showOverall 
    ? filteredRankings.sort((a, b) => a.overall_rank - b.overall_rank)
    : filteredRankings.sort((a, b) => a.category_rank - b.category_rank)

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">Ranking de Efectividad</h1>
          <p className="text-blue-100">Clasificación por win rate y rendimiento general</p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Filtrar por Categoría</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={0}>Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat.number} value={cat.number}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Ranking Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Ranking</label>
              <select
                value={showOverall ? 'overall' : 'category'}
                onChange={(e) => setShowOverall(e.target.value === 'overall')}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="overall">Ranking General</option>
                <option value="category">Ranking por Categoría</option>
              </select>
            </div>

            {/* Statistics */}
            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                <div className="font-bold text-white">{filteredRankings.length}</div>
                <div>jugadores mostrados</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {showOverall ? 'Ranking' : 'Cat.'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Jugador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Puntos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Partidos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Victorias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Efectividad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {displayRankings.map((player, index) => (
                  <tr key={player.player_id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          showOverall 
                            ? (index < 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-600/20 text-gray-400')
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {showOverall ? player.overall_rank : player.category_rank}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{player.player_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(player.current_category)}`}>
                        {getCategoryName(player.current_category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {player.current_points}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {player.total_matches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {player.total_wins}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${getEffectivenessColor(player.effectiveness_rate)}`}>
                        {player.effectiveness_rate.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs ${getActivityColor(player.activity_status)}`}>
                        {player.activity_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-green-400">
              {filteredRankings.filter(r => r.effectiveness_rate >= 70).length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Jugadores Elite (70%+)</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-blue-400">
              {filteredRankings.filter(r => r.effectiveness_rate >= 60 && r.effectiveness_rate < 70).length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Jugadores Buenos (60-70%)</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-yellow-400">
              {filteredRankings.filter(r => r.effectiveness_rate >= 50 && r.effectiveness_rate < 60).length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Jugadores Regulares (50-60%)</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-3xl font-bold text-red-400">
              {filteredRankings.filter(r => r.effectiveness_rate < 50).length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Jugadores en Desarrollo (&lt;50%)</div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
