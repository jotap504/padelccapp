'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import MainLayout from '@/app/components/MainLayout'
import { supabase } from '@/lib/supabase/client'

interface Match {
  id: string
  team_a: any[]
  team_b: any[]
  sets: any[]
  date: string
  status: string
  validated_by: string[] | null
  created_by: string
  category?: number
}

interface Player {
  id: string
  name: string
  member_number: string
  category: number
  rating: number
  club_id: string
}

export default function AllMatchesPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [clubFilter, setClubFilter] = useState<string>('all')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      return
    }
    loadData()
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    filterMatches()
  }, [matches, searchTerm, categoryFilter, genderFilter, clubFilter])

  async function loadData() {
    try {
      // Load all matches without relations first
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: false })
        .limit(100)

      if (matchesError) throw matchesError

      if (matchesData) {
        setMatches(matchesData)
      }

      // Load all players for filters
      const { data: playersData } = await supabase
        .from('users')
        .select('id, name, member_number, category, rating, club_id, gender')
        .eq('status', 'active')

      if (playersData) {
        setPlayers(playersData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterMatches() {
    let filtered = matches

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(m => {
        const teamA = m.team_a || []
        const teamB = m.team_b || []
        const allPlayers = [...teamA, ...teamB]
        return allPlayers.some(p => p.name?.toLowerCase().includes(term))
      })
    }

    if (categoryFilter !== 'all') {
      const cat = parseInt(categoryFilter)
      filtered = filtered.filter(m => {
        const teamA = m.team_a || []
        const teamB = m.team_b || []
        const allPlayers = [...teamA, ...teamB]
        return allPlayers.some(p => p.category === cat) || m.category === cat
      })
    }

    if (genderFilter !== 'all') {
      filtered = filtered.filter(m => {
        const teamA = m.team_a || []
        const teamB = m.team_b || []
        const allPlayers = [...teamA, ...teamB]
        return allPlayers.some(p => p.gender === genderFilter)
      })
    }

    if (clubFilter !== 'all') {
      filtered = filtered.filter(m => {
        const teamA = m.team_a || []
        const teamB = m.team_b || []
        const allPlayers = [...teamA, ...teamB]
        return allPlayers.some(p => p.club_id === clubFilter)
      })
    }

    setFilteredMatches(filtered)
  }

  const categories = Array.from(new Set(matches.map(m => m.category).filter((c): c is number => c !== undefined))).sort((a, b) => a - b)
  const clubs = Array.from(new Set(players.map(p => p.club_id)))

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
      <div className="space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              🎾 Todos los Partidos
            </h1>
            <p className="text-blue-100 text-lg">
              Historial completo de partidos del club
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>🔍</span> Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nombre de jugador..."
                className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Categoría</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}°</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Género</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Club</label>
              <select
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
                className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                {clubs.map(clubId => {
                  const clubPlayers = players.filter(p => p.club_id === clubId)
                  const clubName = clubPlayers[0]?.member_number || clubId
                  return (
                    <option key={clubId} value={clubId}>{clubName}</option>
                  )
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{filteredMatches.length}</div>
              <div className="text-sm text-gray-400">Partidos mostrados</div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{matches.length}</div>
              <div className="text-sm text-gray-400">Total partidos</div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{players.length}</div>
              <div className="text-sm text-gray-400">Jugadores activos</div>
            </div>
          </div>
        </div>

        {/* Matches List */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📋</span> Partidos ({filteredMatches.length})
          </h2>

          {filteredMatches.length > 0 ? (
            <div className="space-y-4">
              {filteredMatches.map((match) => {
                const teamA = match.team_a || []
                const teamB = match.team_b || []
                const teamANames = teamA.map((p: any) => p.name).join(' & ')
                const teamBNames = teamB.map((p: any) => p.name).join(' & ')
                const isCompleted = match.status === 'confirmed'

                // Calculate scores from sets
                const teamAScore = match.sets?.filter((s: any) => s.team_a > s.team_b).length || 0
                const teamBScore = match.sets?.filter((s: any) => s.team_b > s.team_a).length || 0

                return (
                  <div
                    key={match.id}
                    className="bg-gray-700/30 border border-gray-700 rounded-xl p-6 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <div className={`flex-1 ${teamAScore > teamBScore && isCompleted ? 'text-green-400 font-bold' : ''}`}>
                            <div className="text-lg font-semibold text-white">{teamANames || 'Equipo A'}</div>
                            <div className="text-sm text-gray-400">
                              {teamA.map((p: any) => `${p.category}° ${p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'O'}`).join(', ')}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-400">
                            {teamAScore} - {teamBScore}
                          </div>
                          <div className={`flex-1 text-right ${teamBScore > teamAScore && isCompleted ? 'text-green-400 font-bold' : ''}`}>
                            <div className="text-lg font-semibold text-white">{teamBNames || 'Equipo B'}</div>
                            <div className="text-sm text-gray-400">
                              {teamB.map((p: any) => `${p.category}° ${p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'O'}`).join(', ')}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(match.date).toLocaleDateString('es-AR', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="ml-4">
                        {match.status === 'confirmed' ? (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm">
                            Confirmado
                          </span>
                        ) : match.status === 'disputed' ? (
                          <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-sm">
                            Disputado
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full text-sm">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-2">🎾</p>
              <p>No hay partidos que coincidan con los filtros</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
