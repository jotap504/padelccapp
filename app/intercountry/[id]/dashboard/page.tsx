'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Tournament {
  id: string
  name: string
  season: string
  category: number
  start_date: string
  end_date: string
  tournament_type: string
  status: string
  organizer: { name: string }
  participants: number
  max_teams: number
}

interface Player {
  id: string
  name: string
  member_number: string
  category: number
  rating: number
  availability: { day: string, available: boolean }[]
  recent_form: { matches: number, wins: number, avg_score: number }
  chemistry: { partner_id: string, score: number }[]
}

interface Match {
  id: string
  round: number
  home_club: { name: string }
  away_club: { name: string }
  scheduled_date: string
  status: string
  home_team?: { player_id: string, name: string }[]
  away_team?: { player_id: string, name: string }[]
}

interface AISuggestion {
  id: string
  round: number
  opponent_id: string
  opponent_name: string
  suggested_team: Player[]
  confidence_score: number
  reasoning: string[]
  alternatives: Player[][]
}

export default function IntercountryDashboard({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'matches' | 'ai'>('overview')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadData() {
    if (!user) return

    try {
      // Load tournament details
      const { data: tournamentData } = await supabase
        .from('intercountry_tournaments')
        .select(`
          *,
          organizer:intercountry_organizers(name)
        `)
        .eq('id', params.id)
        .single()

      if (tournamentData) {
        setTournament(tournamentData as any)
      }

      // Load registered players
      const { data: registrations } = await supabase
        .from('intercountry_registrations')
        .select(`
          user_id,
          user:users(id, name, member_number, category, rating)
        `)
        .eq('tournament_id', params.id)
        .eq('club_id', user.club_id)
        .eq('status', 'active')

      if (registrations) {
        const playersData = registrations.map((r: any) => ({
          id: r.user.id,
          name: r.user.name,
          member_number: r.user.member_number,
          category: r.user.category,
          rating: r.user.rating || 0,
          availability: [], // TODO: Load from availability system
          recent_form: { matches: 0, wins: 0, avg_score: 0 }, // TODO: Load from match history
          chemistry: [] // TODO: Load from chemistry table
        }))
        setPlayers(playersData)
      }

      // Load matches for this club
      const { data: matchesData } = await supabase
        .from('intercountry_fixtures')
        .select('*')
        .or(`home_club_id.eq.${user.club_id},away_club_id.eq.${user.club_id}`)
        .eq('tournament_id', params.id)
        .order('round', { ascending: true })

      if (matchesData) {
        // Load club details for matches
        const clubIds = [...new Set(matchesData.map((m: any) => [m.home_club_id, m.away_club_id]).flat())]
        const { data: clubs } = await supabase
          .from('clubs')
          .select('id, name')
          .in('id', clubIds)

        const matchesWithDetails = matchesData.map((m: any) => ({
          ...m,
          home_club: clubs?.find((c: any) => c.id === m.home_club_id) || { name: 'Unknown' },
          away_club: clubs?.find((c: any) => c.id === m.away_club_id) || { name: 'Unknown' }
        }))
        setMatches(matchesWithDetails as any)
      }

      // Load AI suggestions
      const { data: suggestionsData } = await supabase
        .from('intercountry_ai_suggestions')
        .select('*')
        .eq('tournament_id', params.id)
        .eq('club_id', user.club_id)
        .order('round', { ascending: true })

      if (suggestionsData) {
        // Transform suggestions data
        setAiSuggestions([]) // TODO: Process suggestions
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function generateAISuggestion(round: number, opponentId: string) {
    // TODO: Implement AI suggestion generation
    console.log('Generating AI suggestion for round', round, 'vs opponent', opponentId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Torneo Intercountry" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Torneo Intercountry" />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">Torneo no encontrado o no tienes acceso.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={tournament.name} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tournament Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span>Organizador: {tournament.organizer?.name}</span>
                <span>Temporada: {tournament.season}</span>
                <span>Categoría: {tournament.category}°</span>
                <span>Tipo: {tournament.tournament_type}</span>
                <span>Equipos: {tournament.participants}/{tournament.max_teams}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
                <span>Inicio: {new Date(tournament.start_date).toLocaleDateString('es-AR')}</span>
                <span>Fin: {new Date(tournament.end_date).toLocaleDateString('es-AR')}</span>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              tournament.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {tournament.status === 'active' ? 'Activo' : 'Inactivo'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Resumen', icon: '📊' },
                { id: 'team', label: 'Equipo', icon: '👥' },
                { id: 'matches', label: 'Partidos', icon: '🏓' },
                { id: 'ai', label: 'IA Assistant', icon: '🤖' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <a 
              href={`/intercountry/${params.id}/manage`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Gestionar Equipo
            </a>
            <a 
              href={`/intercountry/${params.id}/rivals`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Gestionar Rivales
            </a>
            <a 
              href={`/intercountry/${params.id}/lista-buena-fe`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Lista de Buena Fe
            </a>
          </div>
        </div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Resumen del Torneo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{players.length}</div>
                  <div className="text-sm text-gray-600">Jugadores Registrados</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{matches.length}</div>
                  <div className="text-sm text-gray-600">Partidos Programados</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{aiSuggestions.length}</div>
                  <div className="text-sm text-gray-600">Sugerencias IA</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Próximos Partidos</h2>
              <div className="space-y-3">
                {matches.slice(0, 3).map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{match.home_club.name}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-medium">{match.away_club.name}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Fecha {match.round} • {new Date(match.scheduled_date).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Plantilla del Equipo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player) => (
                <div key={player.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium">{player.name}</h3>
                      <p className="text-sm text-gray-600">#{player.member_number}</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      Cat {player.category}°
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <div>Rating: {player.rating}</div>
                    <div>Forma: {player.recent_form.wins}/{player.recent_form.matches} victorias</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Calendario de Partidos</h2>
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{match.home_club.name}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-medium">{match.away_club.name}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      match.status === 'completed' ? 'bg-green-100 text-green-800' :
                      match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {match.status === 'completed' ? 'Completado' :
                       match.status === 'in_progress' ? 'En curso' : 'Programado'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Fecha {match.round} • {new Date(match.scheduled_date).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {match.home_team && match.home_team.length > 0 && (
                    <div className="mt-3 text-sm">
                      <div className="font-medium text-gray-700">Equipo Local:</div>
                      <div className="text-gray-600">
                        {match.home_team.map(p => p.name).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Asistente IA</h2>
              <p className="text-gray-600 mb-4">
                Utilizamos inteligencia artificial para sugerir las mejores combinaciones de jugadores 
                basadas en ranking, química, disponibilidad y forma reciente.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700">
                  🤖 Generar Sugerencias para Próxima Fecha
                </button>
                <button className="bg-purple-600 text-white px-4 py-3 rounded hover:bg-purple-700">
                  📊 Análisis de Rendimiento del Equipo
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Sugerencias Recientes</h3>
              <div className="space-y-4">
                {aiSuggestions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay sugerencias generadas aún.</p>
                    <p className="text-sm mt-2">Hacé clic en "Generar Sugerencias" para comenzar.</p>
                  </div>
                ) : (
                  aiSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Fecha {suggestion.round} vs {suggestion.opponent_name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Confianza:</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${suggestion.confidence_score * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{Math.round(suggestion.confidence_score * 100)}%</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div className="font-medium mb-1">Equipo Sugerido:</div>
                        <div>{suggestion.suggested_team?.map(p => p.name).join(', ')}</div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {suggestion.reasoning?.join(' • ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
