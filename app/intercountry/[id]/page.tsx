'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Torneo no encontrado</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/intercountry')} className="text-gray-500 hover:text-gray-700">
                ← Volver
              </button>
              <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
            </div>
            {tournament.status === 'registration' && !isRegistered && (
              <button
                onClick={registerClub}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Inscribir Club
              </button>
            )}
            {isAdmin && isRegistered && (
              <>
                <button
                  onClick={() => {
                    console.log('ADMIN FIXTURE CLICKED')
                    console.log('Navigating to admin fixture page:', `/intercountry/${id}/admin`)
                    router.push(`/intercountry/${id}/admin`)
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 mr-2"
                >
                  Administrar Fixture
                </button>
                <button
                  onClick={() => {
                    console.log('MANAGE TEAM CLICKED')
                    console.log('Navigating to manage page:', `/intercountry/${id}/manage`)
                    window.location.href = `/intercountry/${id}/manage`
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Gestionar Equipo
                </button>
              </>
            )}
            {!isAdmin && isCaptain && isRegistered && (
              <button
                onClick={() => {
                  console.log('CAPTAIN MANAGE TEAM CLICKED')
                  console.log('Navigating to manage page:', `/intercountry/${id}/manage`)
                  window.location.href = `/intercountry/${id}/manage`
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Gestionar Equipo
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Temporada</p>
              <p className="text-2xl font-bold">{tournament.season}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Categoría</p>
              <p className="text-2xl font-bold">{tournament.category}°</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Tipo</p>
              <p className="text-2xl font-bold">{tournament.type === 'league' ? 'Liga' : tournament.type === 'cup' ? 'Copa' : 'Supercopa'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Formato</p>
              <p className="text-2xl font-bold">{tournament.format === 'home_away' ? 'Ida y Vuelta' : 'Neutral'}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'standings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                }`}
              >
                Tabla de Posiciones
              </button>
              <button
                onClick={() => setActiveTab('fixtures')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'fixtures' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                }`}
              >
                Fixture
              </button>
              {isRegistered && (
                <button
                  onClick={() => setActiveTab('my-matches')}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === 'my-matches' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                  }`}
                >
                  Mis Partidos
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'standings' && (
              <div>
                <h3 className="font-semibold mb-4">Posiciones</h3>
                {standings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Club</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Pts</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">PJ</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">PG</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">PE</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">PP</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Sets</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Games</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {standings.map((team) => (
                          <tr 
                            key={team.id} 
                            className={team.club_id === myClubId ? 'bg-blue-50' : ''}
                          >
                            <td className="px-4 py-3 font-medium">{team.position}</td>
                            <td className="px-4 py-3 font-medium">{team.club_name}</td>
                            <td className="px-4 py-3 text-center font-bold text-blue-600">{team.points}</td>
                            <td className="px-4 py-3 text-center">{team.matches_played}</td>
                            <td className="px-4 py-3 text-center text-green-600">{team.matches_won}</td>
                            <td className="px-4 py-3 text-center text-yellow-600">{team.matches_drawn}</td>
                            <td className="px-4 py-3 text-center text-red-600">{team.matches_lost}</td>
                            <td className="px-4 py-3 text-center">{team.sets_won}-{team.sets_lost}</td>
                            <td className="px-4 py-3 text-center">{team.game_ratio?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No hay datos de posiciones aún</p>
                )}
              </div>
            )}

            {activeTab === 'fixtures' && (
              <div>
                <h3 className="font-semibold mb-4">Fixture</h3>
                {fixtures.length > 0 ? (
                  <div className="space-y-4">
                    {Array.from(new Set(fixtures.map(f => f.round))).map(round => (
                      <div key={round}>
                        <h4 className="font-medium text-gray-700 mb-2">Fecha {round}</h4>
                        <div className="space-y-2">
                          {fixtures
                            .filter(f => f.round === round)
                            .map((match) => (
                              <div 
                                key={match.id}
                                className={`p-3 rounded border ${
                                  match.status === 'completed' ? 'bg-gray-50' : 'bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 text-right pr-4">
                                    <span className={`font-medium ${
                                      match.winner_club_id === match.home_club_id ? 'text-green-700' : ''
                                    }`}>
                                      {match.home_club?.name}
                                    </span>
                                  </div>
                                  <div className="px-4 py-2 bg-gray-100 rounded min-w-[100px] text-center">
                                    {match.status === 'completed' ? (
                                      <span className="font-bold">
                                        {match.home_sets} - {match.away_sets}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-500">vs</span>
                                    )}
                                  </div>
                                  <div className="flex-1 pl-4">
                                    <span className={`font-medium ${
                                      match.winner_club_id === match.away_club_id ? 'text-green-700' : ''
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
                  <p className="text-gray-500 text-center py-8">El fixture aún no ha sido publicado</p>
                )}
              </div>
            )}

            {activeTab === 'my-matches' && isRegistered && (
              <div>
                <h3 className="font-semibold mb-4">Mis Partidos</h3>
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
                          className={`p-4 rounded-lg border ${
                            match.status === 'completed'
                              ? won ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{myTeam} vs {opponent}</p>
                              <p className="text-sm text-gray-500">Fecha {match.round}</p>
                            </div>
                            {match.status === 'completed' ? (
                              <div className="text-right">
                                <p className={`text-2xl font-bold ${won ? 'text-green-700' : 'text-red-700'}`}>
                                  {myScore} - {opponentScore}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {won ? 'Victoria' : 'Derrota'}
                                </p>
                              </div>
                            ) : (
                              <div className="text-right">
                                <p className="text-sm text-gray-500">
                                  {match.scheduled_date 
                                    ? new Date(match.scheduled_date).toLocaleDateString('es-AR')
                                    : 'Fecha por definir'
                                  }
                                </p>
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
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
                  <p className="text-gray-500 text-center py-8">No tienes partidos programados</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
