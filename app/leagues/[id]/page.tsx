'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface League {
  id: string
  name: string
  description: string
  season: string
  category: number
  format: string
  status: string
  start_date: string
  end_date: string
  max_participants: number
  points_per_win: number
  points_per_draw: number
  created_by: string
}

interface Participant {
  id: string
  user_id: string
  user: { name: string; rating: number }
  position: number
  matches_played: number
  matches_won: number
  matches_drawn: number
  matches_lost: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  points: number
  status: string
}

interface Fixture {
  id: string
  round_number: number
  round_name: string
  status: string
  start_date: string
  end_date: string
}

interface LeagueMatch {
  id: string
  fixture_id: string
  participant_a: { id: string; user: { name: string } }
  participant_b: { id: string; user: { name: string } }
  score_a: number
  score_b: number
  sets: any[]
  status: string
  scheduled_date: string
  scheduled_time: string
}

export default function LeagueDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [league, setLeague] = useState<League | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [matches, setMatches] = useState<LeagueMatch[]>([])
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'participants'>('standings')
  const [loading, setLoading] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadLeagueData()
  }, [isLoading, isAuthenticated, params.id])

  async function loadLeagueData() {
    const leagueId = params.id as string
    
    // Load league
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .single()
    
    if (leagueData) {
      setLeague(leagueData)
    }
    
    // Load participants with user info
    const { data: participantsData } = await supabase
      .from('league_participants')
      .select('*, user:user_id(name, rating)')
      .eq('league_id', leagueId)
      .order('position', { ascending: true, nullsFirst: false })
    
    if (participantsData) {
      setParticipants(participantsData)
      setIsRegistered(participantsData.some((p: any) => p.user_id === user?.id))
    }
    
    // Load fixtures
    const { data: fixturesData } = await supabase
      .from('league_fixtures')
      .select('*')
      .eq('league_id', leagueId)
      .order('round_number')
    
    if (fixturesData) {
      setFixtures(fixturesData)
    }
    
    // Load matches
    const { data: matchesData } = await supabase
      .from('league_matches')
      .select('*, participant_a:participant_a_id(id, user:user_id(name)), participant_b:participant_b_id(id, user:user_id(name))')
      .eq('league_id', leagueId)
    
    if (matchesData) {
      setMatches(matchesData)
    }
    
    setLoading(false)
  }

  async function register() {
    if (!user || !league) return
    
    const { error } = await supabase.rpc('register_league_participant', {
      p_league_id: league.id,
      p_user_id: user.id
    })
    
    if (!error) {
      setIsRegistered(true)
      loadLeagueData()
    } else {
      alert('Error al inscribirse: ' + error.message)
    }
  }

  async function generateFixture() {
    if (!league) return
    
    const confirmed = confirm('¿Generar el fixture para esta liga?')
    if (!confirmed) return
    
    const { error } = await supabase.rpc('generate_round_robin_fixture', {
      p_league_id: league.id
    })
    
    if (!error) {
      alert('Fixture generado correctamente')
      loadLeagueData()
    } else {
      alert('Error: ' + error.message)
    }
  }

  function getMatchesForFixture(fixtureId: string) {
    return matches.filter(m => m.fixture_id === fixtureId)
  }

  if (loading || !league) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={league.name} showBack />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* League Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {league.category}° Categoría
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                  {league.season}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{league.name}</h1>
              {league.description && (
                <p className="text-gray-600 mt-2">{league.description}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              {league.status === 'registration' && !isRegistered && (
                <button
                  onClick={register}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Inscribirme
                </button>
              )}
              {isRegistered && (
                <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  ✅ Inscripto
                </span>
              )}
              {league.status === 'registration' && participants.length >= 2 && fixtures.length === 0 && (
                <button
                  onClick={generateFixture}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                  Generar Fixture
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex">
              {[
                { key: 'standings', label: 'Tabla de Posiciones', icon: '📊' },
                { key: 'fixtures', label: 'Fixture', icon: '📅' },
                { key: 'participants', label: 'Participantes', icon: '👥' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Standings Tab */}
            {activeTab === 'standings' && (
              <div>
                {participants.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Jugador</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">PJ</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">PG</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">PE</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">PP</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">Sets</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">Games</th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {participants.map((p, index) => (
                          <tr key={p.id} className={p.user_id === user?.id ? 'bg-blue-50' : ''}>
                            <td className="px-4 py-3 font-bold">{p.position || index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{p.user?.name}</div>
                              <div className="text-xs text-gray-500">Rating: {p.user?.rating}</div>
                            </td>
                            <td className="px-4 py-3 text-center">{p.matches_played}</td>
                            <td className="px-4 py-3 text-center font-medium text-green-600">{p.matches_won}</td>
                            <td className="px-4 py-3 text-center">{p.matches_drawn}</td>
                            <td className="px-4 py-3 text-center font-medium text-red-600">{p.matches_lost}</td>
                            <td className="px-4 py-3 text-center">
                              {p.sets_won}-{p.sets_lost}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-500">
                              {p.games_won}-{p.games_lost}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-blue-600">{p.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No hay participantes registrados</p>
                )}
              </div>
            )}

            {/* Fixtures Tab */}
            {activeTab === 'fixtures' && (
              <div className="space-y-6">
                {fixtures.length > 0 ? (
                  fixtures.map((fixture) => (
                    <div key={fixture.id} className="border rounded-lg">
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <h3 className="font-semibold">{fixture.round_name}</h3>
                        {fixture.start_date && (
                          <p className="text-sm text-gray-500">
                            {new Date(fixture.start_date).toLocaleDateString('es-AR')} - {new Date(fixture.end_date).toLocaleDateString('es-AR')}
                          </p>
                        )}
                      </div>
                      <div className="divide-y">
                        {getMatchesForFixture(fixture.id).map((match) => (
                          <div key={match.id} className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <span className="font-medium flex-1 text-right">{match.participant_a?.user?.name}</span>
                              <div className="px-4 py-2 bg-gray-100 rounded font-bold">
                                {match.status === 'completed' 
                                  ? `${match.score_a} - ${match.score_b}`
                                  : 'VS'
                                }
                              </div>
                              <span className="font-medium flex-1">{match.participant_b?.user?.name}</span>
                            </div>
                            {match.scheduled_date && (
                              <span className="text-sm text-gray-500 ml-4">
                                {new Date(match.scheduled_date).toLocaleDateString('es-AR')}
                                {match.scheduled_time && ` ${match.scheduled_time.substring(0, 5)}`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No hay fixture generado aún</p>
                )}
              </div>
            )}

            {/* Participants Tab */}
            {activeTab === 'participants' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {participants.map((p) => (
                  <div 
                    key={p.id} 
                    className={`p-4 border rounded-lg ${p.user_id === user?.id ? 'border-blue-500 bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                        {p.user?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{p.user?.name}</p>
                        <p className="text-sm text-gray-500">Rating: {p.user?.rating}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 text-sm">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        {p.matches_won} PG
                      </span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                        {p.matches_lost} PP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
