'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import PlayerSearchSelect from '@/app/components/PlayerSearchSelect'

interface Player {
  id: string
  name: string
  category: number | null
  rating: number | null
}

interface Match {
  id: string
  date: string
  status: string
  team_a: any[]
  team_b: any[]
  sets: any[]
  validated_by: string[] | null
  created_by: string
}

export default function MatchesContent() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showOnlyMyMatches, setShowOnlyMyMatches] = useState(true)
  
  useEffect(() => {
    const shouldCreate = searchParams.get('create')
    if (shouldCreate === 'true') {
      setShowCreateForm(true)
    }
  }, [searchParams])
  
  const [myTeam, setMyTeam] = useState<'A' | 'B'>('A')
  const [myPartner, setMyPartner] = useState('')
  const [opponent1, setOpponent1] = useState('')
  const [opponent2, setOpponent2] = useState('')
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0])
  const [format, setFormat] = useState<'3' | '5'>('3')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<React.ReactNode>('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (isAuthenticated) {
      loadPlayers()
      loadMatches()
    }
  }, [isAuthenticated, isLoading, router])

  async function loadPlayers() {
    try {
      const { data, error } = await supabase.from('users').select('id, name, category, rating').order('name')
      if (error) {
        console.error('Error loading players:', error)
      } else {
        setPlayers(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async function loadMatches() {
    try {
      setLoading(true)
      let query = supabase.from('matches').select('*').order('date', { ascending: false })
      
      if (showOnlyMyMatches && user) {
        query = query.or(`team_a.cs.{"user_id":"${user.id}"},team_b.cs.{"user_id":"${user.id}"}`)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error loading matches:', error)
      } else {
        setMatches(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  async function createMatch() {
    if (!user || !myPartner || !opponent1 || !opponent2) {
      setMessage('Por favor completa todos los campos')
      return
    }

    if (!user.club_id) {
      setMessage(
        <div className="space-y-2">
          <p>Error: Sesion sin club_id. Necesitas cerrar sesion y volver a entrar.</p>
          <button 
            onClick={() => { localStorage.removeItem('padel_session'); window.location.href = '/login'; }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Cerrar sesion y reintentar
          </button>
        </div>
      )
      return
    }

    setCreating(true)
    setMessage('')

    try {
      const teamA = myTeam === 'A' 
        ? [{ user_id: user.id, name: user.name }, { user_id: myPartner, name: players.find(p => p.id === myPartner)?.name }]
        : [{ user_id: opponent1, name: players.find(p => p.id === opponent1)?.name }, { user_id: opponent2, name: players.find(p => p.id === opponent2)?.name }]
      
      const teamB = myTeam === 'A'
        ? [{ user_id: opponent1, name: players.find(p => p.id === opponent1)?.name }, { user_id: opponent2, name: players.find(p => p.id === opponent2)?.name }]
        : [{ user_id: user.id, name: user.name }, { user_id: myPartner, name: players.find(p => p.id === myPartner)?.name }]

      const matchData = {
        club_id: user.club_id,
        date: matchDate,
        status: 'pending',
        team_a: teamA,
        team_b: teamB,
        sets: [],
        validated_by: [user.id],
        created_by: user.id
      }
      
      console.log('Creating match with data:', matchData)

      const { data, error } = await supabase.from('matches').insert(matchData)

      if (error) {
        console.error('Error creating match:', error)
        setMessage(`Error al crear el partido: ${error.message} (code: ${error.code})`)
      } else {
        setMessage('Partido creado exitosamente!')
        setShowCreateForm(false)
        setMyPartner('')
        setOpponent1('')
        setOpponent2('')
        loadMatches()
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Error al crear el partido')
    } finally {
      setCreating(false)
    }
  }

  async function handleValidate(matchId: string) {
    if (!user) return
    try {
      const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).single()
      if (!m) return
      const validatedBy = m.validated_by || []
      if (!validatedBy.includes(user.id)) validatedBy.push(user.id)
      const { error } = await supabase.from('matches').update({ 
        validated_by: validatedBy, 
        status: validatedBy.length >= 2 ? 'confirmed' : 'pending' 
      }).eq('id', matchId)
      if (error) console.error('Error:', error)
      else loadMatches()
    } catch (err) {
      console.error('Error:', err)
    }
  }

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
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">Mis Partidos</h1>
          <p className="text-blue-100">Gestiona tus partidos y resultados</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? 'Cancelar' : 'Crear Partido'}
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Crear Nuevo Partido</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Fecha</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Formato</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as '3' | '5')}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="3">Mejor de 3 sets</option>
                  <option value="5">Mejor de 5 sets</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tu equipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMyTeam('A')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      myTeam === 'A' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Equipo A
                  </button>
                  <button
                    onClick={() => setMyTeam('B')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      myTeam === 'B' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Equipo B
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tu compañero {myTeam === 'A' ? '(Equipo A)' : '(Equipo B)'}
                </label>
                <PlayerSearchSelect
                  players={players.filter(p => p.id !== user?.id)}
                  value={myPartner}
                  onChange={setMyPartner}
                  placeholder="Buscar compañero..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Oponente 1 {myTeam === 'A' ? '(Equipo B)' : '(Equipo A)'}
                </label>
                <PlayerSearchSelect
                  players={players.filter(p => p.id !== user?.id && p.id !== myPartner)}
                  value={opponent1}
                  onChange={setOpponent1}
                  placeholder="Buscar oponente 1..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Oponente 2 {myTeam === 'A' ? '(Equipo B)' : '(Equipo A)'}
                </label>
                <PlayerSearchSelect
                  players={players.filter(p => p.id !== user?.id && p.id !== myPartner && p.id !== opponent1)}
                  value={opponent2}
                  onChange={setOpponent2}
                  placeholder="Buscar oponente 2..."
                />
              </div>
            </div>

            {message && (
              <div className={`mt-4 p-3 rounded-lg ${
                typeof message === 'string' && message.includes('exitosamente') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {message}
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <button
                onClick={createMatch}
                disabled={creating || !myPartner || !opponent1 || !opponent2}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando...' : 'Crear Partido'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            {showOnlyMyMatches ? 'Mis Partidos' : 'Todos los Partidos'}
          </h2>
          
          {matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id}>
                  <div className={match.status === 'confirmed' 
                    ? 'rounded-lg p-4 bg-green-900/30 border border-green-700/30' 
                    : match.sets && Array.isArray(match.sets) && match.sets.length > 0 && match.sets.some((s: any) => s.team_a > 0 || s.team_b > 0)
                    ? 'rounded-lg p-4 bg-yellow-900/30 border border-yellow-700/30' 
                    : 'rounded-lg p-4 bg-blue-900/30 border border-blue-700/30'
                  }>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {new Date(match.date).toLocaleDateString('es-AR')}
                        </p>
                        <p className="text-gray-300 text-sm font-medium mt-1">
                          {match.team_a?.map((p: any) => p.name || 'Jugador').join(' + ')} vs {match.team_b?.map((p: any) => p.name || 'Jugador').join(' + ')}
                        </p>
                        
                        {match.sets && match.sets.length > 0 && match.sets.some((s: any) => s.team_a > 0 || s.team_b > 0) ? (
                          <div className="mt-2">
                            <p className="text-gray-400 text-xs mb-1">Resultado:</p>
                            <div className="flex gap-2">
                              {match.sets.map((s: any, i: number) => (
                                <span key={i} className="px-2 py-1 bg-gray-600 rounded text-xs text-white">
                                  {s.team_a || 0} - {s.team_b || 0}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : match.status === 'confirmed' ? (
                          <div className="mt-2">
                            <p className="text-gray-400 text-xs mb-1">Resultado:</p>
                            <span className="px-2 py-1 bg-yellow-600 rounded text-xs text-white">Sin registrar</span>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-gray-400 text-xs mb-1">Resultado:</p>
                            <span className="px-2 py-1 bg-gray-600 rounded text-xs text-white">Por jugar</span>
                          </div>
                        )}
                        
                        <p className="text-gray-500 text-sm mt-2">
                          Estado: {match.status === 'confirmed' ? 'Confirmado' : match.sets && match.sets.some((s: any) => s.team_a > 0 || s.team_b > 0) ? 'A espera de validacion' : 'Por jugar'}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        {/* Cargar Resultado - solo si no hay resultado guardado y esta pendiente */}
                        {match.status === 'pending' && (!match.sets || !match.sets.some((s: any) => s.team_a > 0 || s.team_b > 0)) && (
                          <button
                            onClick={() => window.location.href = `/matches/${match.id}/edit`}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                          >
                            Cargar Resultado
                          </button>
                        )}
                        {/* Editar Resultado - solo si hay resultado, esta pendiente, y el usuario puede editar */}
                        {match.status === 'pending' && match.sets && match.sets.some((s: any) => s.team_a > 0 || s.team_b > 0) && (
                          <button
                            onClick={() => window.location.href = `/matches/${match.id}/edit`}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                          >
                            Editar Resultado
                          </button>
                        )}
                        {/* Registrar Resultado - si esta confirmado pero sin resultado (caso raro) */}
                        {match.status === 'confirmed' && (!match.sets || !match.sets.some((s: any) => s.team_a > 0 || s.team_b > 0)) && (
                          <button
                            onClick={() => window.location.href = `/matches/${match.id}/edit`}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                          >
                            Registrar Resultado
                          </button>
                        )}
                        <button
                          onClick={() => window.location.href = `/matches/${match.id}`}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Detalles
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    {match.status === 'pending' && !match.validated_by?.includes(user?.id || '') && (
                      <button
                        onClick={() => handleValidate(match.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        Validar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">-</p>
              <p>No hay partidos registrados</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
