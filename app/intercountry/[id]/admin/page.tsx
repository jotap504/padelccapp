'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Club {
  id: string
  name: string
}

interface Player {
  id: string
  name: string
  member_number: string
  category: number
}

interface Fixture {
  id: string
  round: number
  matchday?: number
  home_club_id: string
  away_club_id: string
  home_club: { name: string }
  away_club: { name: string }
  home_team?: { user_id: string, name: string }[]
  away_team?: { user_id: string, name: string }[]
  scheduled_date: string
  status: string
}

export default function AdminIntercountryFixturePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<any>(null)
  const [participatingClubs, setParticipatingClubs] = useState<Club[]>([])
  const [clubPlayers, setClubPlayers] = useState<Record<string, Player[]>>({})
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Form states
  const [selectedRound, setSelectedRound] = useState(1)
  const [homeClubId, setHomeClubId] = useState('')
  const [awayClubId, setAwayClubId] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [matchesPerRound, setMatchesPerRound] = useState(2) // Default 2 matches per round
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, {home: string[], away: string[]}>>({})
  
  // Tournament configuration
  const [totalRounds, setTotalRounds] = useState(10)
  const [matchDays, setMatchDays] = useState<string[]>(['saturday'])
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    setIsAdmin(user?.role === 'admin' || user?.role === 'superadmin')
    loadData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadData() {
    if (!user) return
    
    // Load tournament
    const { data: tournamentData } = await supabase
      .from('intercountry_tournaments')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (tournamentData) {
      setTournament(tournamentData)
    }

    // Load participating clubs
    const { data: participants } = await supabase
      .from('intercountry_participants')
      .select('club_id, club:clubs(id, name)')
      .eq('tournament_id', params.id)
      .eq('status', 'active')

    if (participants) {
      const clubs = participants.map((p: any) => ({
        id: p.club.id,
        name: p.club.name
      }))
      setParticipatingClubs(clubs)
    }

    // Load existing fixtures
    const { data: fixturesData } = await supabase
      .from('intercountry_fixtures')
      .select('*, home_club:clubs!home_club_id(name), away_club:clubs!away_club_id(name)')
      .eq('tournament_id', params.id)
      .order('round', { ascending: true })

    if (fixturesData) {
      setFixtures(fixturesData as any)
    }

    // Load players for each participating club
    const playersData: Record<string, Player[]> = {}
    for (const club of participatingClubs) {
      const { data: registrations } = await supabase
        .from('intercountry_registrations')
        .select(`
          user_id,
          status,
          user:users (id, name, member_number, category)
        `)
        .eq('tournament_id', params.id)
        .eq('club_id', club.id)
        .eq('status', 'active')
      
      if (registrations) {
        playersData[club.id] = registrations.map((r: any) => ({
          id: r.user.id,
          name: r.user.name,
          member_number: r.user.member_number,
          category: r.user.category
        }))
      }
    }
    setClubPlayers(playersData)

    setLoading(false)
  }

  async function addMatch() {
    if (!homeClubId || !awayClubId || !matchDate) {
      alert('Complete todos los campos')
      return
    }

    if (homeClubId === awayClubId) {
      alert('El equipo local y visitante no pueden ser el mismo')
      return
    }

    setSaving(true)

    // Get selected players for this match
    const matchKey = `${homeClubId}-${awayClubId}-${selectedRound}`
    const homePlayers = selectedPlayers[matchKey]?.home || []
    const awayPlayers = selectedPlayers[matchKey]?.away || []

    const { error } = await supabase
      .from('intercountry_fixtures')
      .insert({
        tournament_id: params.id,
        round: selectedRound,
        matchday: Math.floor((fixtures.length + 1) / matchesPerRound) + 1,
        home_club_id: homeClubId,
        away_club_id: awayClubId,
        home_team: homePlayers.map(id => ({ user_id: id, name: clubPlayers[homeClubId]?.find(p => p.id === id)?.name || '' })),
        away_team: awayPlayers.map(id => ({ user_id: id, name: clubPlayers[awayClubId]?.find(p => p.id === id)?.name || '' })),
        scheduled_date: new Date(matchDate).toISOString(),
        status: 'scheduled'
      })

    if (error) {
      alert('Error al crear partido: ' + error.message)
    } else {
      // Reset form
      setHomeClubId('')
      setAwayClubId('')
      setMatchDate('')
      // Clear selected players for this match
      const newSelectedPlayers = { ...selectedPlayers }
      delete newSelectedPlayers[matchKey]
      setSelectedPlayers(newSelectedPlayers)
      // Reload fixtures
      loadData()
    }

    setSaving(false)
  }

  async function deleteMatch(matchId: string) {
    if (!confirm('¿Eliminar este partido?')) return

    const { error } = await supabase
      .from('intercountry_fixtures')
      .delete()
      .eq('id', matchId)

    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      loadData()
    }
  }

  async function generateRoundRobin() {
    if (participatingClubs.length < 2) {
      alert('Se necesitan al menos 2 equipos participantes')
      return
    }

    if (!confirm(`¿Generar fixture con ${matchesPerRound} partidos por fecha para ${participatingClubs.length} equipos?`)) {
      return
    }

    setSaving(true)

    const clubs = participatingClubs
    const numClubs = clubs.length
    const rounds = Math.ceil((numClubs * (numClubs - 1)) / matchesPerRound) // Calculate rounds needed
    
    // Generate round-robin using circle method
    const teams = [...clubs]
    const fixtures = []
    let matchCounter = 0

    for (let round = 1; round <= rounds; round++) {
      for (let i = 0; i < Math.min(matchesPerRound, Math.floor(numClubs / 2)); i++) {
        const home = teams[i]
        const away = teams[numClubs - 1 - i]
        
        if (home && away && home.id !== away.id) {
          fixtures.push({
            tournament_id: params.id,
            round: round,
            matchday: round,
            home_club_id: home.id,
            away_club_id: away.id,
            home_team: [], // Empty initially, to be filled later
            away_team: [], // Empty initially, to be filled later
            scheduled_date: null,
            status: 'scheduled'
          })
          matchCounter++
        }
      }
      
      // Rotate teams (keep first team fixed)
      teams.splice(1, 0, teams.pop()!)
    }

    // Insert all fixtures
    const { error } = await supabase
      .from('intercountry_fixtures')
      .insert(fixtures)

    if (error) {
      alert('Error al generar fixture: ' + error.message)
    } else {
      alert(`Fixture generado: ${fixtures.length} partidos en ${rounds} fechas (${matchesPerRound} partidos por fecha)`)
      loadData()
    }

    setSaving(false)
  }

  async function saveTournamentConfig() {
    setSaving(true)

    const { error } = await supabase
      .from('intercountry_tournaments')
      .update({
        total_rounds: totalRounds,
        match_days: matchDays
      })
      .eq('id', params.id)

    if (error) {
      alert('Error al guardar configuración: ' + error.message)
    } else {
      alert('Configuración guardada correctamente')
      loadData()
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Administrar Fixture" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Administrar Fixture" />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">Acceso restringido. Solo administradores pueden gestionar el fixture.</p>
          </div>
        </div>
      </div>
    )
  }

  const fixturesByRound = fixtures.reduce((acc, fixture) => {
    if (!acc[fixture.round]) acc[fixture.round] = []
    acc[fixture.round].push(fixture)
    return acc
  }, {} as Record<number, Fixture[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Administrar Fixture - ${tournament?.name || 'Intercountry'}`} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tournament Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament?.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Temporada: {tournament?.season}</span>
            <span>Categoría: {tournament?.category}°</span>
            <span>Equipos participantes: {participatingClubs.length}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <a 
              href={`/intercountry/${params.id}/admin/teams`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Administrar Equipos →
            </a>
            <a 
              href={`/intercountry/${params.id}/manage`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Gestionar Plantilla
            </a>
            <a 
              href={`/intercountry/${params.id}/lista-buena-fe`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Lista de Buena Fe
            </a>
          </div>
        </div>

        {/* Tournament Configuration */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Configuración del Torneo</h2>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              {showConfig ? 'Ocultar' : 'Configurar'}
            </button>
          </div>
          
          {showConfig && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total de Fechas</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de Juego</label>
                  <div className="space-y-2">
                    {[
                      { value: 'monday', label: 'Lunes' },
                      { value: 'tuesday', label: 'Martes' },
                      { value: 'wednesday', label: 'Miércoles' },
                      { value: 'thursday', label: 'Jueves' },
                      { value: 'friday', label: 'Viernes' },
                      { value: 'saturday', label: 'Sábado' },
                      { value: 'sunday', label: 'Domingo' }
                    ].map((day) => (
                      <label key={day.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={matchDays.includes(day.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMatchDays([...matchDays, day.value])
                            } else {
                              setMatchDays(matchDays.filter(d => d !== day.value))
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={saveTournamentConfig}
                    disabled={saving}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Configuración actual:</strong> {totalRounds} fechas, 
                  {matchDays.map(day => {
                    const dayLabels: Record<string, string> = {
                      monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
                      thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
                    }
                    return dayLabels[day]
                  }).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Auto-generate Fixture */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Generar Fixture Automático</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partidos por Fecha</label>
              <select
                value={matchesPerRound}
                onChange={(e) => setMatchesPerRound(parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
              >
                <option value={2}>2 partidos por fecha</option>
                <option value={3}>3 partidos por fecha</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Crea un fixture de todos contra todos (ida y vuelta) automáticamente para {participatingClubs.length} equipos.
          </p>
          <button
            onClick={generateRoundRobin}
            disabled={saving || participatingClubs.length < 2}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Generando...' : `Generar Liga (${matchesPerRound} partidos/fecha)`}
          </button>
        </div>

        {/* Add Match Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Agregar Partido Manual</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha N°</label>
              <input
                type="number"
                min={1}
                value={selectedRound}
                onChange={(e) => setSelectedRound(parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
              <select
                value={homeClubId}
                onChange={(e) => setHomeClubId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Seleccionar...</option>
                {participatingClubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visitante</label>
              <select
                value={awayClubId}
                onChange={(e) => setAwayClubId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Seleccionar...</option>
                {participatingClubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Partido</label>
              <input
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={addMatch}
                disabled={saving}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Agregar Partido
              </button>
            </div>
          </div>
        </div>

        {/* Player Selection for Match */}
        {homeClubId && awayClubId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Seleccionar Jugadores</h2>
            <p className="text-sm text-gray-600 mb-4">
              Seleccioná los jugadores que disputarán este partido.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Home Team Players */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">
                  {participatingClubs.find(c => c.id === homeClubId)?.name} - Local
                </h3>
                {clubPlayers[homeClubId] && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                    {clubPlayers[homeClubId].map((player) => {
                      const matchKey = `${homeClubId}-${awayClubId}-${selectedRound}`
                      const isSelected = selectedPlayers[matchKey]?.home?.includes(player.id)
                      
                      return (
                        <label key={player.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSelectedPlayers = { ...selectedPlayers }
                              if (!newSelectedPlayers[matchKey]) {
                                newSelectedPlayers[matchKey] = { home: [], away: [] }
                              }
                              
                              if (e.target.checked) {
                                newSelectedPlayers[matchKey].home.push(player.id)
                              } else {
                                newSelectedPlayers[matchKey].home = newSelectedPlayers[matchKey].home.filter(id => id !== player.id)
                              }
                              
                              setSelectedPlayers(newSelectedPlayers)
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{player.name}</span>
                            <span className="text-sm text-gray-500 ml-2">#{player.member_number}</span>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded ml-2">
                              Cat {player.category}°
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Away Team Players */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">
                  {participatingClubs.find(c => c.id === awayClubId)?.name} - Visitante
                </h3>
                {clubPlayers[awayClubId] && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                    {clubPlayers[awayClubId].map((player) => {
                      const matchKey = `${homeClubId}-${awayClubId}-${selectedRound}`
                      const isSelected = selectedPlayers[matchKey]?.away?.includes(player.id)
                      
                      return (
                        <label key={player.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSelectedPlayers = { ...selectedPlayers }
                              if (!newSelectedPlayers[matchKey]) {
                                newSelectedPlayers[matchKey] = { home: [], away: [] }
                              }
                              
                              if (e.target.checked) {
                                newSelectedPlayers[matchKey].away.push(player.id)
                              } else {
                                newSelectedPlayers[matchKey].away = newSelectedPlayers[matchKey].away.filter(id => id !== player.id)
                              }
                              
                              setSelectedPlayers(newSelectedPlayers)
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{player.name}</span>
                            <span className="text-sm text-gray-500 ml-2">#{player.member_number}</span>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded ml-2">
                              Cat {player.category}°
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fixtures List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Fixture ({fixtures.length} partidos)</h2>
          
          {Object.entries(fixturesByRound).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(fixturesByRound).map(([round, roundFixtures]) => (
                <div key={round}>
                  <h3 className="font-medium text-gray-700 mb-3">Fecha {round}</h3>
                  <div className="space-y-2">
                    {roundFixtures.map((match) => (
                      <div 
                        key={match.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <span className="font-medium text-right flex-1">{match.home_club?.name}</span>
                          <span className="text-gray-400">vs</span>
                          <span className="font-medium flex-1">{match.away_club?.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {match.scheduled_date && (
                            <span className="text-sm text-gray-500">
                              {new Date(match.scheduled_date).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs ${
                            match.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : match.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {match.status === 'completed' ? 'Finalizado' : 
                             match.status === 'in_progress' ? 'En juego' : 'Pendiente'}
                          </span>
                          <button
                            onClick={() => deleteMatch(match.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay partidos cargados aún</p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.push(`/intercountry/${params.id}`)}
            className="bg-gray-300 text-gray-700 px-6 py-3 rounded hover:bg-gray-400 font-medium"
          >
            Volver al Torneo
          </button>
        </div>
      </main>
    </div>
  )
}
