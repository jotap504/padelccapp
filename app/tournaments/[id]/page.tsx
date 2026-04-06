'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import PlayerSearchSelect from '@/app/components/PlayerSearchSelect'

interface Tournament {
  id: string
  name: string
  description: string
  type: string
  category: number
  max_participants: number
  start_date: string
  status: string
  rules: string
  created_by: string
}

interface Registration {
  id: string
  user_id: string
  partner_id: string | null
  status: string
  user: { name: string }
  partner?: { name: string }
}

interface Match {
  id: string
  round: number
  bracket_position: string
  team_a: any[]
  team_b: any[]
  winner_team: string | null
  sets: any[]
  scheduled_date: string
  status: string
}

export default function TournamentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'bracket'>('info')
  const [loading, setLoading] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])

  // Load data function - defined with useCallback to be reusable
  const loadData = useCallback(async () => {
    if (!id || !user) return
    
    // Load tournament
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single()
    
    if (tournamentData) setTournament(tournamentData)
    
    // Load registrations with user info
    const { data: regData } = await supabase
      .from('tournament_registrations')
      .select('*, user:users!user_id(name), partner:users!partner_id(name)')
      .eq('tournament_id', id)
    
    if (regData) {
      setRegistrations(regData)
      setIsRegistered(regData.some(r => r.user_id === user.id))
    }
    
    // Load matches
    const { data: matchesData } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', id)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true })
    
    if (matchesData) setMatches(matchesData)
    
    // Load players for partner selection
    const { data: playersData } = await supabase
      .from('users')
      .select('id, name')
      .eq('club_id', user.club_id)
      .eq('status', 'active')
    
    if (playersData) setPlayers(playersData.filter(p => p.id !== user.id))
    
    setLoading(false)
  }, [id, user])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    loadData()
  }, [isLoading, isAuthenticated, router, loadData])

  async function handleRegister() {
    if (!user || !tournament) return
    
    const { error } = await supabase.from('tournament_registrations').insert({
      tournament_id: id,
      user_id: user.id,
      partner_id: selectedPartner?.id || null,
      status: 'confirmed'
    })
    
    if (!error) {
      loadData()
      setSelectedPartner(null)
    }
  }

  async function generateBracket() {
    if (!tournament) return
    
    const response = await fetch(`/api/tournaments/${id}/generate-bracket`, { method: 'POST' })
    if (response.ok) {
      loadData()
    }
  }

  const getBracketRounds = () => {
    const rounds: Record<number, Match[]> = {}
    matches.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = []
      rounds[m.round].push(m)
    })
    return rounds
  }

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
              <button onClick={() => router.push('/tournaments')} className="text-gray-500 hover:text-gray-700">
                ← Volver
              </button>
              <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
            </div>
            {tournament.status === 'registration_open' && !isRegistered && (
              <button
                onClick={handleRegister}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Inscribirme
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'info' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                }`}
              >
                Información
              </button>
              <button
                onClick={() => setActiveTab('participants')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'participants' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                }`}
              >
                Participantes ({registrations.length})
              </button>
              <button
                onClick={() => setActiveTab('bracket')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'bracket' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
                }`}
              >
                Fixture
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'info' && (
              <div className="space-y-4">
                <p className="text-gray-700">{tournament.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Categoría</p>
                    <p className="text-lg font-bold">{tournament.category}°</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Tipo</p>
                    <p className="text-lg font-bold">{tournament.type.replace('_', ' ')}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Participantes</p>
                    <p className="text-lg font-bold">{registrations.length}/{tournament.max_participants}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">Inicio</p>
                    <p className="text-lg font-bold">
                      {new Date(tournament.start_date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </div>

                {tournament.rules && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Reglas</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{tournament.rules}</p>
                  </div>
                )}

                {tournament.status === 'registration_open' && !isRegistered && (
                  <div className="mt-6 p-4 bg-green-50 rounded">
                    <h3 className="font-semibold text-green-800 mb-3">Inscribirme</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Buscar compañero (opcional para dobles)
                      </label>
                      <PlayerSearchSelect
                        players={players}
                        value={selectedPartner?.id || ''}
                        onChange={(id) => {
                          const partner = players.find(p => p.id === id)
                          setSelectedPartner(partner || null)
                        }}
                        placeholder="Nombre del compañero..."
                        excludeIds={[user?.id || '']}
                      />
                    </div>
                    <button
                      onClick={handleRegister}
                      className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                    >
                      Confirmar Inscripción
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'participants' && (
              <div>
                <h3 className="font-semibold mb-4">Listado de Participantes</h3>
                {registrations.length > 0 ? (
                  <div className="space-y-2">
                    {registrations.map((reg, index) => (
                      <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-500 font-medium">#{index + 1}</span>
                          <div>
                            <p className="font-medium">{reg.user?.name}</p>
                            {reg.partner && (
                              <p className="text-sm text-gray-500">Compañero: {reg.partner.name}</p>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          reg.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {reg.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No hay inscriptos aún</p>
                )}
              </div>
            )}

            {activeTab === 'bracket' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Fixture</h3>
                  {matches.length === 0 && tournament.status === 'registration_closed' && (
                    <button
                      onClick={generateBracket}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Generar Bracket
                    </button>
                  )}
                </div>
                
                {matches.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(getBracketRounds()).map(([round, roundMatches]) => (
                      <div key={round}>
                        <h4 className="font-medium text-gray-700 mb-3">Ronda {round}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roundMatches.map((match) => (
                            <div 
                              key={match.id} 
                              className={`border rounded p-3 ${
                                match.status === 'completed' ? 'bg-gray-50' : 'bg-white'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500">{match.bracket_position}</span>
                                {match.status === 'completed' && (
                                  <span className="text-xs text-green-600">✓ Finalizado</span>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className={`flex justify-between ${match.winner_team === 'A' ? 'font-bold text-green-700' : ''}`}>
                                  <span className="text-sm">
                                    {match.team_a?.map((p: any) => p.name || 'TBD').join(' & ') || 'Por definir'}
                                  </span>
                                  <span className="text-sm font-mono">
                                    {match.sets?.reduce((acc: number, s: any) => acc + (s.games_a || 0), 0) || '-'}
                                  </span>
                                </div>
                                <div className={`flex justify-between ${match.winner_team === 'B' ? 'font-bold text-green-700' : ''}`}>
                                  <span className="text-sm">
                                    {match.team_b?.map((p: any) => p.name || 'TBD').join(' & ') || 'Por definir'}
                                  </span>
                                  <span className="text-sm font-mono">
                                    {match.sets?.reduce((acc: number, s: any) => acc + (s.games_b || 0), 0) || '-'}
                                  </span>
                                </div>
                              </div>
                              {match.sets && match.sets.length > 0 && (
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                  {match.sets.map((s: any) => `${s.games_a}-${s.games_b}`).join(', ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">El bracket aún no ha sido generado</p>
                    <p className="text-sm text-gray-400">
                      Se generará automáticamente cuando cierren las inscripciones
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
