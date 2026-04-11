'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import Link from 'next/link'

interface Tournament {
  id: string
  name: string
  description: string
  season: number
  type: string
  category: number
  status: string
  format: string
}

interface Standing {
  id: string
  club_id: string
  club_name: string
  position: number
  points: number
  matches_played: number
  matches_won: number
  matches_drawn: number
  matches_lost: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  set_ratio: number
  game_ratio: number
}

interface Fixture {
  id: string
  round: number
  home_club_id: string
  away_club_id: string
  home_club: { name: string }
  away_club: { name: string }
  home_sets: number
  away_sets: number
  home_games: number
  away_games: number
  winner_club_id: string | null
  scheduled_date: string
  status: string
}

export default function IntercountryDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'my-matches'>('standings')
  const [loading, setLoading] = useState(true)
  const [myClubId, setMyClubId] = useState<string | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [isCaptain, setIsCaptain] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    setIsAdmin(user?.role === 'admin' || user?.role === 'superadmin')
    loadData()
  }, [isLoading, isAuthenticated, id, user])

  async function loadData() {
    if (!id || !user) return
    
    setMyClubId(user.club_id)
    
    // Load tournament
    const { data: tournamentData } = await supabase
      .from('intercountry_tournaments')
      .select('*')
      .eq('id', id)
      .single()
    
    if (tournamentData) setTournament(tournamentData)
    
    // Load standings
    const { data: standingsData } = await supabase
      .from('intercountry_standings')
      .select('*')
      .eq('tournament_id', id)
    
    if (standingsData) setStandings(standingsData)
    
    // Load fixtures
    const { data: fixturesData } = await supabase
      .from('intercountry_fixtures')
      .select('*, home_club:clubs!home_club_id(name), away_club:clubs!away_club_id(name)')
      .eq('tournament_id', id)
      .order('round', { ascending: true })
      .order('scheduled_date', { ascending: true })
    
    if (fixturesData) setFixtures(fixturesData)
    
    // Check if club is registered
    const { data: participant } = await supabase
      .from('intercountry_participants')
      .select('*')
      .eq('tournament_id', id)
      .eq('club_id', user.club_id)
      .single()
    
    setIsRegistered(!!participant)
    if (participant) {
      setIsCaptain(participant.list_manager_id === user.id)
    }
    setLoading(false)
  }

  async function registerClub() {
    if (!user || !tournament) return
    
    const { error } = await supabase.from('intercountry_participants').insert({
      tournament_id: id,
      club_id: user.club_id
    })
    
    if (!error) {
      loadData()
    }
  }

  const myFixtures = fixtures.filter(f => 
    f.home_club_id === myClubId || f.away_club_id === myClubId
  )

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    )
  }

  if (!tournament) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Torneo no encontrado</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/intercountry" className="text-purple-200 hover:text-white transition-colors">
                ← Volver
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              🏆 {tournament.name}
            </h1>
            <p className="text-purple-100 text-lg">
              {tournament.description || 'Torneo Intercountry'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {tournament.status === 'registration' && !isRegistered && (
            <button
              onClick={registerClub}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/25 transition-all duration-300 hover:scale-105"
            >
              Inscribir Club
            </button>
          )}
          {isAdmin && isRegistered && (
            <>
              <button
                onClick={() => router.push(`/intercountry/${id}/admin`)}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105"
              >
                Administrar Fixture
              </button>
              <button
                onClick={() => router.push(`/intercountry/${id}/manage`)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105"
              >
                Gestionar Equipo
              </button>
            </>
          )}
          {!isAdmin && isCaptain && isRegistered && (
            <button
              onClick={() => router.push(`/intercountry/${id}/manage`)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105"
            >
              Gestionar Equipo
            </button>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-400">Temporada</p>
              <p className="text-2xl font-bold text-white">{tournament.season}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Categoría</p>
              <p className="text-2xl font-bold text-white">{tournament.category}°</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Tipo</p>
              <p className="text-2xl font-bold text-white">{tournament.type === 'league' ? 'Liga' : tournament.type === 'cup' ? 'Copa' : 'Supercopa'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Formato</p>
              <p className="text-2xl font-bold text-white">{tournament.format === 'home_away' ? 'Ida y Vuelta' : 'Neutral'}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          <div className="border-b border-gray-700">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ${
                  activeTab === 'standings'
                    ? 'border-b-2 border-purple-500 text-purple-400 bg-purple-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                📊 Tabla de Posiciones
              </button>
              <button
                onClick={() => setActiveTab('fixtures')}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ${
                  activeTab === 'fixtures'
                    ? 'border-b-2 border-purple-500 text-purple-400 bg-purple-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                📅 Fixture
              </button>
              {isRegistered && (
                <button
                  onClick={() => setActiveTab('my-matches')}
                  className={`px-6 py-4 text-sm font-medium transition-all duration-300 ${
                    activeTab === 'my-matches'
                      ? 'border-b-2 border-purple-500 text-purple-400 bg-purple-500/10'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  🏓 Mis Partidos
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'standings' && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>📊</span> Tabla de Posiciones
                </h3>
                {standings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">Club</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">Pts</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">PJ</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">PG</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">PE</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">PP</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">Sets</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">Games</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {standings.map((team) => (
                          <tr
                            key={team.id}
                            className={team.club_id === myClubId ? 'bg-purple-500/20' : 'hover:bg-gray-700/50 transition-colors'}
                          >
                            <td className="px-4 py-3 font-medium text-white">{team.position}</td>
                            <td className="px-4 py-3 font-medium text-white">{team.club_name}</td>
                            <td className="px-4 py-3 text-center font-bold text-purple-400">{team.points}</td>
                            <td className="px-4 py-3 text-center text-gray-300">{team.matches_played}</td>
                            <td className="px-4 py-3 text-center text-green-400">{team.matches_won}</td>
                            <td className="px-4 py-3 text-center text-yellow-400">{team.matches_drawn}</td>
                            <td className="px-4 py-3 text-center text-red-400">{team.matches_lost}</td>
                            <td className="px-4 py-3 text-center text-gray-300">{team.sets_won}-{team.sets_lost}</td>
                            <td className="px-4 py-3 text-center text-gray-300">{team.game_ratio?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">📊</p>
                    <p>No hay datos de posiciones aún</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'fixtures' && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>📅</span> Fixture
                </h3>
                {fixtures.length > 0 ? (
                  <div className="space-y-4">
                    {Array.from(new Set(fixtures.map(f => f.round))).map(round => (
                      <div key={round}>
                        <h4 className="font-medium text-gray-300 mb-2">Fecha {round}</h4>
                        <div className="space-y-2">
                          {fixtures
                            .filter(f => f.round === round)
                            .map((match) => (
                              <div
                                key={match.id}
                                className={`p-3 rounded-lg border transition-all duration-300 hover:scale-[1.01] ${
                                  match.status === 'completed' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-800/50 border-gray-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 text-right pr-4">
                                    <span className={`font-medium ${
                                      match.winner_club_id === match.home_club_id ? 'text-green-400' : 'text-gray-300'
                                    }`}>
                                      {match.home_club?.name}
                                    </span>
                                  </div>
                                  <div className="px-4 py-2 bg-gray-700 rounded-lg min-w-[100px] text-center">
                                    {match.status === 'completed' ? (
                                      <span className="font-bold text-white">
                                        {match.home_sets} - {match.away_sets}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-400">vs</span>
                                    )}
                                  </div>
                                  <div className="flex-1 pl-4">
                                    <span className={`font-medium ${
                                      match.winner_club_id === match.away_club_id ? 'text-green-400' : 'text-gray-300'
                                    }`}>
                                      {match.away_club?.name}
                                    </span>
                                  </div>
                                </div>
                                {match.scheduled_date && (
                                  <p className="text-xs text-gray-500 text-center mt-2">
                                    {new Date(match.scheduled_date).toLocaleDateString('es-AR')}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">📅</p>
                    <p>El fixture aún no ha sido publicado</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'my-matches' && isRegistered && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🏓</span> Mis Partidos
                </h3>
                {myFixtures.length > 0 ? (
                  <div className="space-y-3">
                    {myFixtures.map((match) => {
                      const isHome = match.home_club_id === myClubId
                      const myTeam = isHome ? match.home_club?.name : match.away_club?.name
                      const opponent = isHome ? match.away_club?.name : match.home_club?.name
                      const myScore = isHome ? match.home_sets : match.away_sets
                      const opponentScore = isHome ? match.away_sets : match.home_sets
                      const won = match.winner_club_id === myClubId

                      return (
                        <div
                          key={match.id}
                          className={`p-4 rounded-lg border transition-all duration-300 hover:scale-[1.01] ${
                            match.status === 'completed'
                              ? won ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                              : 'bg-gray-800/50 border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-white">{myTeam} vs {opponent}</p>
                              <p className="text-sm text-gray-400">Fecha {match.round}</p>
                            </div>
                            {match.status === 'completed' ? (
                              <div className="text-right">
                                <p className={`text-2xl font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
                                  {myScore} - {opponentScore}
                                </p>
                                <p className="text-sm text-gray-400">
                                  {won ? 'Victoria' : 'Derrota'}
                                </p>
                              </div>
                            ) : (
                              <div className="text-right">
                                <p className="text-sm text-gray-400">
                                  {match.scheduled_date
                                    ? new Date(match.scheduled_date).toLocaleDateString('es-AR')
                                    : 'Fecha por definir'
                                  }
                                </p>
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-500/30">
                                  Pendiente
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">🏓</p>
                    <p>No tienes partidos programados</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
