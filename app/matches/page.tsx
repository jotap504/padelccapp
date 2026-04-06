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

export default function MatchesPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showOnlyMyMatches, setShowOnlyMyMatches] = useState(false)
  
  // Check for create=true parameter
  useEffect(() => {
    const shouldCreate = searchParams.get('create')
    if (shouldCreate === 'true') {
      setShowCreateForm(true)
    }
  }, [searchParams])
  
  // Create match form
  const [myTeam, setMyTeam] = useState<'A' | 'B'>('A')
  const [myPartner, setMyPartner] = useState('')
  const [opponent1, setOpponent1] = useState('')
  const [opponent2, setOpponent2] = useState('')
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [format, setFormat] = useState<'3' | '5'>('3')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  
  // Edit match states
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [editSets, setEditSets] = useState<{gamesA: string, gamesB: string}[]>([])
  const [editTeamA, setEditTeamA] = useState<any[]>([])
  const [editTeamB, setEditTeamB] = useState<any[]>([])
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isLoading, isAuthenticated, user])

  async function loadData() {
    if (!user) return
    
    try {
      const { data: playersData } = await supabase
        .from('users')
        .select('id, name, category, rating')
        .eq('club_id', user.club_id)
        .eq('status', 'active')
        .order('name')
      
      if (playersData) setPlayers(playersData)
      
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('club_id', user.club_id)
        .order('date', { ascending: false })
        .limit(20)
      
      if (matchesData) setMatches(matchesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    
    setCreating(true)
    setMessage('')
    
    if (!myPartner || !opponent1 || !opponent2) {
      setMessage('Error: Seleccioná tu compañero y los 2 rivales')
      setCreating(false)
      return
    }
    
    if (new Set([user.id, myPartner, opponent1, opponent2]).size !== 4) {
      setMessage('Error: Los 4 jugadores deben ser diferentes')
      setCreating(false)
      return
    }
    
    try {
      const myTeamData = [
        { user_id: user.id, side: 'drive', position: 'left' },
        { user_id: myPartner, side: 'backhand', position: 'right' }
      ]
      
      const opponentTeamData = [
        { user_id: opponent1, side: 'drive', position: 'left' },
        { user_id: opponent2, side: 'backhand', position: 'right' }
      ]
      
      const teamAData = myTeam === 'A' ? myTeamData : opponentTeamData
      const teamBData = myTeam === 'A' ? opponentTeamData : myTeamData
      
      const numSets = parseInt(format)
      const emptySets = Array(numSets).fill(null).map(() => ({
        games_a: 0,
        games_b: 0
      }))
      
      const matchData = {
        club_id: String(user.club_id),
        team_a: teamAData,
        team_b: teamBData,
        sets: emptySets,
        status: 'pending',
        date: new Date(matchDate + 'T12:00:00').toISOString(),
        created_by: String(user.id)
      }
      
      const { error } = await supabase.from('matches').insert(matchData)
      
      if (error) throw error
      
      setMessage('Partido creado correctamente')
      setMyPartner('')
      setOpponent1('')
      setOpponent2('')
      setMyTeam('A')
      setMatchDate(new Date().toISOString().split('T')[0])
      setFormat('3')
      setShowCreateForm(false)
      loadData()
    } catch (error: any) {
      setMessage('Error: ' + error.message)
    } finally {
      setCreating(false)
    }
  }

  function getPlayerName(id: string) {
    return players.find(p => p.id === id)?.name || 'Desconocido'
  }

  function getScoreString(match: Match) {
    if (!match.sets || match.sets.length === 0) return '-'
    return match.sets.map((s: any) => `${s.games_a}-${s.games_b}`).join(', ')
  }

  function canEditMatch(match: Match) {
    if (!user) return false
    const isInTeamA = match.team_a?.some((p: any) => p.user_id === user.id)
    const isInTeamB = match.team_b?.some((p: any) => p.user_id === user.id)
    return isInTeamA || isInTeamB
  }

  function hasValidated(match: Match) {
    if (!user || !match.validated_by) return false
    return match.validated_by.includes(user.id)
  }

  function startEditing(match: Match) {
    setEditingMatch(match)
    setUpdateMessage('')
    const initialSets = match.sets?.map((s: any) => ({
      gamesA: s.games_a?.toString() || '0',
      gamesB: s.games_b?.toString() || '0'
    })) || [{gamesA: '0', gamesB: '0'}, {gamesA: '0', gamesB: '0'}, {gamesA: '0', gamesB: '0'}]
    setEditSets(initialSets)
    setEditTeamA(match.team_a ? [...match.team_a] : [])
    setEditTeamB(match.team_b ? [...match.team_b] : [])
  }

  async function handleUpdateScore(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !editingMatch) return

    setUpdating(true)
    setUpdateMessage('')

    try {
      const setsData = editSets.map(s => ({
        games_a: parseInt(s.gamesA) || 0,
        games_b: parseInt(s.gamesB) || 0
      }))

      const { error } = await supabase
        .from('matches')
        .update({
          sets: setsData,
          team_a: editTeamA,
          team_b: editTeamB,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMatch.id)

      if (error) throw error

      setUpdateMessage('✓ Resultado actualizado correctamente')
      loadData()
    } catch (error: any) {
      setUpdateMessage('Error: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  async function handleValidateMatch() {
    if (!user || !editingMatch) return

    setUpdating(true)
    setUpdateMessage('')

    try {
      const currentValidated = editingMatch.validated_by || []
      
      if (currentValidated.includes(user.id)) {
        setUpdateMessage('Ya validaste este partido')
        return
      }

      const newValidated = [...currentValidated, user.id]
      const newStatus = newValidated.length >= 2 ? 'confirmed' : 'pending'

      const { error } = await supabase
        .from('matches')
        .update({
          validated_by: newValidated,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMatch.id)

      if (error) throw error

      if (newStatus === 'confirmed') {
        setUpdateMessage('✓ Partido confirmado! Ranking actualizado.')
      } else {
        setUpdateMessage('Validación registrada. Falta validación del otro equipo.')
      }
      
      loadData()
      setTimeout(() => setEditingMatch(null), 2000)
    } catch (error: any) {
      setUpdateMessage('Error: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  function isMyMatch(match: Match) {
    if (!user) return false
    return match.team_a?.some((p: any) => p.user_id === user.id) || 
           match.team_b?.some((p: any) => p.user_id === user.id)
  }

  const filteredMatches = showOnlyMyMatches 
    ? matches.filter(isMyMatch)
    : matches

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Partidos</h1>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyMyMatches}
              onChange={(e) => setShowOnlyMyMatches(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600 text-blue-500"
            />
            Solo mis partidos
          </label>
        </div>

        {/* Create Match Button */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span>➕</span> Crear Partido
            </span>
          </button>
        )}

        {/* Create Match Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateMatch} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6 rounded-xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🏓</span> Nuevo Partido
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {message && (
              <div className={`rounded-lg p-4 ${message.includes('Error') ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            {/* Player Info */}
            <div className="bg-gradient-to-r from-blue-600/20 to-blue-700/20 border border-blue-500/30 rounded-xl p-4">
              <p className="text-blue-100">
                <span className="font-semibold">Jugador:</span> {user?.name}
              </p>
            </div>

            {/* Team Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">¿En qué equipo estás?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    value="A"
                    checked={myTeam === 'A'}
                    onChange={(e) => setMyTeam(e.target.value as 'A' | 'B')}
                    className="w-5 h-5 rounded-full bg-gray-700 border-gray-600 text-blue-500"
                  />
                  <span className="text-gray-300 group-hover:text-white transition-colors">Equipo A</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    value="B"
                    checked={myTeam === 'B'}
                    onChange={(e) => setMyTeam(e.target.value as 'A' | 'B')}
                    className="w-5 h-5 rounded-full bg-gray-700 border-gray-600 text-blue-500"
                  />
                  <span className="text-gray-300 group-hover:text-white transition-colors">Equipo B</span>
                </label>
              </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* My Team */}
              <div className={`border rounded-xl p-4 ${myTeam === 'A' ? 'border-blue-500/30 bg-blue-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                <h3 className={`font-medium mb-3 ${myTeam === 'A' ? 'text-blue-400' : 'text-red-400'}`}>
                  Mi Equipo ({myTeam})
                </h3>
                <div className="space-y-3">
                  <div className="text-sm text-gray-300 bg-gray-700/50 p-2 rounded">
                    {user?.name} (Vos)
                  </div>
                  <PlayerSearchSelect
                    players={players}
                    value={myPartner}
                    onChange={setMyPartner}
                    placeholder="Buscar compañero..."
                    required
                    excludeIds={[user?.id || '']}
                  />
                </div>
              </div>

              {/* Opponent Team */}
              <div className={`border rounded-xl p-4 ${myTeam === 'A' ? 'border-red-500/30 bg-red-500/10' : 'border-blue-500/30 bg-blue-500/10'}`}>
                <h3 className={`font-medium mb-3 ${myTeam === 'A' ? 'text-red-400' : 'text-blue-400'}`}>
                  Equipo Rival ({myTeam === 'A' ? 'B' : 'A'})
                </h3>
                <div className="space-y-3">
                  <PlayerSearchSelect
                    players={players}
                    value={opponent1}
                    onChange={setOpponent1}
                    placeholder="Buscar rival 1..."
                    required
                    excludeIds={[user?.id || '', myPartner]}
                  />
                  <PlayerSearchSelect
                    players={players}
                    value={opponent2}
                    onChange={setOpponent2}
                    placeholder="Buscar rival 2..."
                    required
                    excludeIds={[user?.id || '', myPartner, opponent1]}
                  />
                </div>
              </div>
            </div>

            {/* Date and Format */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fecha del partido</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Formato</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as '3' | '5')}
                  className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                >
                  <option value="3">A 3 sets</option>
                  <option value="5">Al mejor de 5 sets</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {creating ? 'Guardando...' : 'Crear Partido'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Edit Match Modal */}
        {editingMatch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Cargar Resultado</h2>
                  <button
                    onClick={() => setEditingMatch(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {updateMessage && (
                  <div className={`mb-4 rounded-lg p-3 ${updateMessage.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                    <p className="text-sm">{updateMessage}</p>
                  </div>
                )}

                <form onSubmit={handleUpdateScore} className="space-y-4">
                  {/* Teams */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/30">
                      <p className="font-medium text-blue-400 text-sm mb-2">Equipo A</p>
                      <div className="space-y-1">
                        {editTeamA.map((p: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-300">
                            {idx === 0 ? '①' : '②'} {getPlayerName(p.user_id)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/30">
                      <p className="font-medium text-red-400 text-sm mb-2">Equipo B</p>
                      <div className="space-y-1">
                        {editTeamB.map((p: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-300">
                            {idx === 0 ? '①' : '②'} {getPlayerName(p.user_id)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Resultado</h3>
                    <div className="space-y-2">
                      {editSets.map((set, idx) => (
                        <div key={idx} className="flex items-center justify-center gap-4">
                          <span className="text-sm text-gray-400 w-16">Set {idx + 1}:</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={set.gamesA}
                            onChange={(e) => {
                              const newSets = [...editSets]
                              newSets[idx].gamesA = e.target.value
                              setEditSets(newSets)
                            }}
                            className="w-20 rounded-lg bg-gray-700 border-gray-600 text-white text-center"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={set.gamesB}
                            onChange={(e) => {
                              const newSets = [...editSets]
                              newSets[idx].gamesB = e.target.value
                              setEditSets(newSets)
                            }}
                            className="w-20 rounded-lg bg-gray-700 border-gray-600 text-white text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={updating}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {updating ? 'Guardando...' : 'Guardar Resultado'}
                    </button>
                    {!hasValidated(editingMatch) && (
                      <button
                        type="button"
                        onClick={handleValidateMatch}
                        disabled={updating}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        {updating ? 'Validando...' : 'Validar'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Matches List */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Últimos Partidos</h2>
            <span className="text-sm text-gray-400">{filteredMatches.length} partidos</span>
          </div>
          
          {filteredMatches.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-4xl mb-2">🏓</p>
              <p>No hay partidos registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredMatches.map((match) => (
                <div key={match.id} className="p-4 hover:bg-gray-700/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          match.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {match.status === 'confirmed' ? '✓ Confirmado' : '⏳ Pendiente'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(match.date).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-blue-400">Equipo A</p>
                          <p className="text-gray-300">
                            {match.team_a?.map((p: any) => getPlayerName(p.user_id)).join(' + ')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-red-400">Equipo B</p>
                          <p className="text-gray-300">
                            {match.team_b?.map((p: any) => getPlayerName(p.user_id)).join(' + ')}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">{getScoreString(match)}</p>
                      {match.status === 'pending' && canEditMatch(match) && (
                        <button
                          onClick={() => startEditing(match)}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                        >
                          {hasValidated(match) ? 'Editar' : 'Cargar / Validar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
