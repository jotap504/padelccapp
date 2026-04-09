'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import Link from 'next/link'

interface RankingUser {
  id: string
  name: string
  category: number | null
  rating: number | null
  total_matches: number
  win_rate: number | null
  gender?: string
}

const CATEGORIES = [
  { value: 1, label: '1ra Categoría' },
  { value: 2, label: '2da Categoría' },
  { value: 3, label: '3ra Categoría' },
  { value: 4, label: '4ta Categoría' },
  { value: 5, label: '5ta Categoría' },
  { value: 6, label: '6ta Categoría' },
  { value: 7, label: '7ma Categoría' },
  { value: 8, label: '8va Categoría' }
]

const GENDERS = [
  { value: 'all', label: 'Todos' },
  { value: 'M', label: 'Hombres' },
  { value: 'F', label: 'Mujeres' }
]

export default function RankingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [rankings, setRankings] = useState<RankingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGender, setSelectedGender] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadRankings()
  }, [isLoading, isAuthenticated, router, selectedGender, selectedCategory])

  async function loadRankings() {
    try {
      setLoading(true)
      let query = supabase
        .from('users')
        .select('id, name, category, rating, total_matches, win_rate, gender')
        .or('role.eq.user,role.is.null')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })

      // Aplicar filtros
      if (selectedGender !== 'all') {
        // Por ahora, asumimos que el campo gender existe o lo agregaremos después
        query = query.eq('gender', selectedGender)
      }
      
      if (selectedCategory !== null) {
        query = query.eq('category', selectedCategory)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading rankings:', error)
        setRankings([])
      } else {
        setRankings(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setRankings([])
    } finally {
      setLoading(false)
    }
  }

  function getTopThreeByCategory(category: number, gender: string = 'all') {
    return rankings
      .filter(player => player.category === category)
      .filter(player => gender === 'all' || player.gender === gender)
      .slice(0, 3)
  }

  function getMedalEmoji(position: number) {
    switch(position) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return ''
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 Ranking por Categorías</h1>
          <p className="text-blue-100">Sistema de puntos acumulativos (máx. 500 para ascender)</p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gender Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Género</label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {GENDERS.map(gender => (
                  <option key={gender.value} value={gender.value}>
                    {gender.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Categoría</label>
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas las categorías</option>
                {CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Rankings Display */}
        {selectedCategory !== null ? (
          // Single Category View
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {CATEGORIES.find(c => c.value === selectedCategory)?.label} - {GENDERS.find(g => g.value === selectedGender)?.label}
            </h2>
            
            {rankings.filter(player => player.category === selectedCategory).length > 0 ? (
              <div className="space-y-3">
                {rankings
                  .filter(player => player.category === selectedCategory)
                  .map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/20 text-gray-300' :
                          index === 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-600/20 text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <Link href={`/compare?player=${player.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                            {player.name}
                          </Link>
                          <div className="text-sm text-gray-400">
                            {player.total_matches} partidos
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-400">
                            {player.rating || 0}
                          </div>
                          <div className="text-sm text-gray-400">Puntos</div>
                          {/* Progress bar to 500 */}
                          <div className="w-20 h-1 bg-gray-600 rounded-full mt-1">
                            <div 
                              className="h-1 bg-blue-400 rounded-full transition-all"
                              style={{ width: `${Math.min((player.rating || 0) / 5, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${
                            (player.win_rate || 0) >= 60 ? 'text-green-400' :
                            (player.win_rate || 0) >= 40 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {player.win_rate || 0}%
                          </div>
                          <div className="text-sm text-gray-400">Victorias</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">🏆</p>
                <p>No hay jugadores en esta categoría</p>
              </div>
            )}
          </div>
        ) : (
          // All Categories View - Top 3 per category
          <div className="space-y-6">
            {CATEGORIES.map(category => {
              const topThree = getTopThreeByCategory(category.value, selectedGender)
              if (topThree.length === 0) return null
              
              return (
                <div key={category.value} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    {category.label}
                    <span className="text-sm text-gray-400">({GENDERS.find(g => g.value === selectedGender)?.label})</span>
                  </h3>
                  
                  <div className="space-y-3">
                    {topThree.map((player, index) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getMedalEmoji(index + 1)}</span>
                          <div>
                            <Link href={`/compare?player=${player.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                              {player.name}
                            </Link>
                            <div className="text-sm text-gray-400">
                              {player.total_matches} partidos
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-400">{player.rating || 0}</div>
                          <div className="text-xs text-gray-400">Puntos</div>
                          {/* Progress bar to 500 */}
                          <div className="w-16 h-1 bg-gray-600 rounded-full mt-1">
                            <div 
                              className="h-1 bg-blue-400 rounded-full transition-all"
                              style={{ width: `${Math.min((player.rating || 0) / 5, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {topThree.length > 0 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setSelectedCategory(category.value)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        Ver ranking completo
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Navigation */}
        {selectedCategory !== null && (
          <div className="text-center">
            <button
              onClick={() => setSelectedCategory(null)}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Ver todas las categorías
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
