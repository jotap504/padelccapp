'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import MainLayout from '@/app/components/MainLayout'
import { supabase } from '@/lib/supabase/client'

interface Match {
  id: string
  player1_id: string
  player2_id: string
  player1_name: string
  player2_name: string
  player1_score: number
  player2_score: number
  winner_id: string | null
  date: string
  category: number
  court_id: string | null
  status: string
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
      // Load all matches with player data
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:player1_id(name, member_number, category, rating, club_id, gender),
          player2:player2_id(name, member_number, category, rating, club_id, gender)
        `)
        .order('date', { ascending: false })
        .limit(100)

      if (matchesError) throw matchesError

      if (matchesData) {
        const formattedMatches = matchesData.map((m: any) => ({
          ...m,
          player1_name: m.player1?.name || 'Desconocido',
          player2_name: m.player2?.name || 'Desconocido',
          player1_gender: m.player1?.gender,
          player2_gender: m.player2?.gender,
          player1_club_id: m.player1?.club_id,
          player2_club_id: m.player2?.club_id
        }))
        setMatches(formattedMatches)
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
      filtered = filtered.filter(m =>
        m.player1_name.toLowerCase().includes(term) ||
        m.player2_name.toLowerCase().includes(term) ||
        m.player1_name.toLowerCase().includes(term) ||
        m.player2_name.toLowerCase().includes(term)
      )
    }

    if (categoryFilter !== 'all') {
      const cat = parseInt(categoryFilter)
      filtered = filtered.filter(m => m.category === cat)
    }

    if (genderFilter !== 'all') {
      filtered = filtered.filter(m =>
        (m as any).player1_gender === genderFilter ||
        (m as any).player2_gender === genderFilter
      )
    }

    if (clubFilter !== 'all') {
      filtered = filtered.filter(m =>
        (m as any).player1_club_id === clubFilter ||
        (m as any).player2_club_id === clubFilter
      )
    }

    setFilteredMatches(filtered)
  }

  const categories = Array.from(new Set(matches.map(m => m.category))).sort((a, b) => a - b)
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
                const isPlayer1Winner = match.winner_id === match.player1_id
                const isPlayer2Winner = match.winner_id === match.player2_id
                const isCompleted = match.status === 'completed'

                return (
                  <div
                    key={match.id}
                    className="bg-gray-700/30 border border-gray-700 rounded-xl p-6 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <div className={`flex-1 ${isPlayer1Winner && isCompleted ? 'text-green-400 font-bold' : ''}`}>
                            <div className="text-lg font-semibold text-white">{match.player1_name}</div>
                            <div className="text-sm text-gray-400">
                              {match.category}° • {(match as any).player1_gender === 'male' ? 'M' : (match as any).player1_gender === 'female' ? 'F' : 'O'}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-400">
                            {match.player1_score} - {match.player2_score}
                          </div>
                          <div className={`flex-1 text-right ${isPlayer2Winner && isCompleted ? 'text-green-400 font-bold' : ''}`}>
                            <div className="text-lg font-semibold text-white">{match.player2_name}</div>
                            <div className="text-sm text-gray-400">
                              {match.category}° • {(match as any).player2_gender === 'male' ? 'M' : (match as any).player2_gender === 'female' ? 'F' : 'O'}
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
                        {isCompleted ? (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm">
                            Finalizado
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
