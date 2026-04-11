'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Player {
  id: string
  name: string
  member_number: string | null
  category: number | null
  rating: number | null
  total_matches: number
  win_rate: number | null
  handedness: string | null
  preferred_side: string | null
}

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: '1', label: '1ra' },
  { value: '2', label: '2da' },
  { value: '3', label: '3ra' },
  { value: '4', label: '4ta' },
  { value: '5', label: '5ta' },
  { value: '6', label: '6ta' },
  { value: '7', label: '7ma' },
  { value: '8', label: '8va' },
]

export default function RankingPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [players, setPlayers] = useState<Player[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadPlayers()
  }, [isLoading, isAuthenticated, user])

  useEffect(() => {
    filterPlayers()
  }, [players, categoryFilter, searchTerm])

  async function loadPlayers() {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, member_number, category, rating, total_matches, win_rate, handedness, preferred_side')
        .eq('club_id', user.club_id)
        .eq('status', 'active')
        .order('rating', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        setPlayers(data)
      }
    } catch (error) {
      console.error('Error loading players:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterPlayers() {
    let filtered = [...players]
    
    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category?.toString() === categoryFilter)
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.member_number?.toLowerCase().includes(term)
      )
    }
    
    setFilteredPlayers(filtered)
  }

  function getCategoryLabel(category: number | null) {
    if (!category) return '-'
    const cat = CATEGORIES.find(c => c.value === category.toString())
    return cat?.label || `${category}°`
  }

  function getConfidenceBadge(matches: number) {
    if (matches >= 20) return { label: 'Estable', color: 'bg-green-100 text-green-800' }
    if (matches >= 10) return { label: 'Regular', color: 'bg-yellow-100 text-yellow-800' }
    return { label: 'Nuevo', color: 'bg-blue-100 text-blue-800' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Ranking" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Ranking" />

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar jugador</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre o número de socio..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-blue-600">{filteredPlayers.length}</p>
            <p className="text-sm text-gray-600">Jugadores</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-green-600">
              {filteredPlayers.filter(p => p.category === 1).length}
            </p>
            <p className="text-sm text-gray-600">1ra Categoría</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-purple-600">
              {Math.round(filteredPlayers.reduce((acc, p) => acc + (p.rating || 0), 0) / (filteredPlayers.length || 1))}
            </p>
            <p className="text-sm text-gray-600">Rating Promedio</p>
          </div>
        </div>

        {/* Ranking Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugador</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cat.</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Partidos</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% Victoria</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay jugadores en esta categoría
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, index) => {
                  const confidence = getConfidenceBadge(player.total_matches)
                  return (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="cursor-pointer" onClick={() => router.push(`/players/${player.id}`)}>
                          <p className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">{player.name}</p>
                          <p className="text-xs text-gray-500">Socio: {player.member_number || '-'}</p>
                          {player.handedness && player.handedness !== 'unknown' && (
                            <p className="text-xs text-gray-400">
                              {player.handedness === 'right' ? 'Diestro' : 'Zurdo'}
                              {player.preferred_side && player.preferred_side !== 'unknown' && 
                                ` • ${player.preferred_side === 'drive' ? 'Drive' : player.preferred_side === 'backhand' ? 'Revés' : 'Ambos'}`
                              }
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs rounded ${
                          player.category === 1 ? 'bg-purple-100 text-purple-800' :
                          player.category === 2 ? 'bg-blue-100 text-blue-800' :
                          player.category === 3 ? 'bg-cyan-100 text-cyan-800' :
                          player.category === 4 ? 'bg-green-100 text-green-800' :
                          player.category === 5 ? 'bg-yellow-100 text-yellow-800' :
                          player.category === 6 ? 'bg-orange-100 text-orange-800' :
                          player.category === 7 ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getCategoryLabel(player.category)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">
                        {player.rating || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {player.total_matches}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {player.win_rate ? `${player.win_rate}%` : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs rounded ${confidence.color}`}>
                          {confidence.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
