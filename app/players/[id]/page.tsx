'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

interface RankingHistory {
  id: string
  rating_before: number
  rating_after: number
  delta: number
  created_at: string
  matches: {
    date: string
    team_a: any[]
    team_b: any[]
    sets: any[]
  }
}

interface Match {
  id: string
  date: string
  team_a: any[]
  team_b: any[]
  sets: any[]
  status: string
}

export default function PlayerProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [player, setPlayer] = useState<Player | null>(null)
  const [rankingHistory, setRankingHistory] = useState<RankingHistory[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'stats'>('overview')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadPlayerData()
  }, [isLoading, isAuthenticated, id])

  async function loadPlayerData() {
    if (!id || !user) return
    
    try {
      // Load player info
      const { data: playerData } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      
      if (playerData) setPlayer(playerData)
      
      // Load ranking history
      const { data: historyData } = await supabase
        .from('ranking_history')
        .select('*, matches(date, team_a, team_b, sets)')
        .eq('user_id', id)
        .order('created_at', { ascending: true })
      
      if (historyData) setRankingHistory(historyData)
      
      // Load matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .or(`team_a.cs.{"user_id":"${id}"},team_b.cs.{"user_id":"${id}"}`)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
      
      if (matchesData) setMatches(matchesData)
    } catch (error) {
      console.error('Error loading player data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data
  const chartData = rankingHistory.map((h, index) => ({
    date: new Date(h.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    rating: h.rating_after,
    delta: h.delta,
    match: index + 1
  }))

  // Calculate stats
  const wins = matches.filter(m => {
    const inTeamA = m.team_a?.some((p: any) => p.user_id === id)
    const inTeamB = m.team_b?.some((p: any) => p.user_id === id)
    const setsA = m.sets?.filter((s: any) => s.games_a > s.games_b).length || 0
    const setsB = m.sets?.filter((s: any) => s.games_b > s.games_a).length || 0
    return (inTeamA && setsA > setsB) || (inTeamB && setsB > setsA)
  }).length

  const losses = matches.length - wins
  
  const totalGamesWon = matches.reduce((acc, m) => {
    const inTeamA = m.team_a?.some((p: any) => p.user_id === id)
    return acc + (inTeamA 
      ? m.sets?.reduce((sum: number, s: any) => sum + (s.games_a || 0), 0) || 0
      : m.sets?.reduce((sum: number, s: any) => sum + (s.games_b || 0), 0) || 0
    )
  }, 0)

  const totalGamesLost = matches.reduce((acc, m) => {
    const inTeamA = m.team_a?.some((p: any) => p.user_id === id)
    return acc + (inTeamA 
      ? m.sets?.reduce((sum: number, s: any) => sum + (s.games_b || 0), 0) || 0
      : m.sets?.reduce((sum: number, s: any) => sum + (s.games_a || 0), 0) || 0
    )
  }, 0)

  const getCategoryLabel = (cat: number | null) => {
    if (!cat) return '-'
    return `${cat}°`
  }

  const getHandednessLabel = (h: string | null) => {
    if (h === 'right') return 'Diestro'
    if (h === 'left') return 'Zurdo'
    return '-'
  }

  const getSideLabel = (s: string | null) => {
    if (s === 'drive') return 'Drive'
    if (s === 'backhand') return 'Revés'
    if (s === 'both') return 'Ambos'
    return '-'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Jugador no encontrado</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/ranking')} className="text-gray-500 hover:text-gray-700">
                ← Volver al Ranking
              </button>
              <h1 className="text-xl font-bold text-gray-900">Perfil de Jugador</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Player Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
                {player.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{player.name}</h2>
                <p className="text-gray-500">Socio: {player.member_number || '-'}</p>
                <div className="flex space-x-4 mt-2">
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    player.category === 1 ? 'bg-purple-100 text-purple-800' :
                    player.category === 2 ? 'bg-blue-100 text-blue-800' :
                    player.category === 3 ? 'bg-cyan-100 text-cyan-800' :
                    player.category === 4 ? 'bg-green-100 text-green-800' :
                    player.category === 5 ? 'bg-yellow-100 text-yellow-800' :
                    player.category === 6 ? 'bg-orange-100 text-orange-800' :
                    player.category === 7 ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getCategoryLabel(player.category)} Categoría
                  </span>
                  <span className="text-sm text-gray-600">
                    {getHandednessLabel(player.handedness)} • {getSideLabel(player.preferred_side)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-blue-600">{player.rating || '-'}</p>
              <p className="text-sm text-gray-500">Rating Actual</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-blue-600">{player.total_matches}</p>
            <p className="text-sm text-gray-600">Partidos Jugados</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-green-600">{wins}</p>
            <p className="text-sm text-gray-600">Victorias</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-red-600">{losses}</p>
            <p className="text-sm text-gray-600">Derrotas</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-purple-600">{player.win_rate || 0}%</p>
            <p className="text-sm text-gray-600">% Victoria</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'overview' 
                    ? 'border-b-2 border-blue-500 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Evolución
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'history' 
                    ? 'border-b-2 border-blue-500 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Historial de Partidos
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'stats' 
                    ? 'border-b-2 border-blue-500 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Estadísticas Detalladas
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Evolución del Rating</h3>
                {chartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={['dataMin - 50', 'dataMax + 50']} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [
                            name === 'rating' ? `${value} pts` : `${value > 0 ? '+' : ''}${value} pts`,
                            name === 'rating' ? 'Rating' : 'Cambio'
                          ]}
                          labelFormatter={(label) => `Fecha: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="rating" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          dot={{ fill: '#2563eb' }}
                          name="rating"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No hay datos de evolución disponibles</p>
                )}
                
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Games Ganados</p>
                    <p className="text-2xl font-bold text-green-600">{totalGamesWon}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Games Perdidos</p>
                    <p className="text-2xl font-bold text-red-600">{totalGamesLost}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Diferencia</p>
                    <p className={`text-2xl font-bold ${totalGamesWon - totalGamesLost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalGamesWon - totalGamesLost > 0 ? '+' : ''}{totalGamesWon - totalGamesLost}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Historial de Partidos</h3>
                {matches.length > 0 ? (
                  <div className="space-y-3">
                    {matches.map((match) => {
                      const inTeamA = match.team_a?.some((p: any) => p.user_id === id)
                      const teamWon = inTeamA 
                        ? match.sets?.filter((s: any) => s.games_a > s.games_b).length > match.sets?.filter((s: any) => s.games_b > s.games_a).length
                        : match.sets?.filter((s: any) => s.games_b > s.games_a).length > match.sets?.filter((s: any) => s.games_a > s.games_b).length
                      
                      return (
                        <div key={match.id} className={`p-4 rounded-lg border ${teamWon ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{new Date(match.date).toLocaleDateString('es-AR')}</p>
                              <p className="text-sm text-gray-600">
                                {match.sets?.map((s: any) => `${s.games_a}-${s.games_b}`).join(', ')}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded text-sm font-medium ${
                              teamWon ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {teamWon ? 'Victoria' : 'Derrota'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No hay partidos registrados</p>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Estadísticas Detalladas</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium text-gray-700 mb-3">Rendimiento</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Victorias:</span>
                        <span className="font-medium">{wins} ({((wins / matches.length) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Derrotas:</span>
                        <span className="font-medium">{losses} ({((losses / matches.length) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Games/Partido:</span>
                        <span className="font-medium">{matches.length > 0 ? ((totalGamesWon + totalGamesLost) / matches.length).toFixed(1) : '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium text-gray-700 mb-3">Games</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Ganados:</span>
                        <span className="font-medium text-green-600">{totalGamesWon}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Perdidos:</span>
                        <span className="font-medium text-red-600">{totalGamesLost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ratio:</span>
                        <span className="font-medium">
                          {totalGamesLost > 0 ? (totalGamesWon / totalGamesLost).toFixed(2) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
