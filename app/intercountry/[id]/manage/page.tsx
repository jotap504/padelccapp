'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import Link from 'next/link'

interface Player {
  id: string
  name: string
  member_number: string
  category: number
  rating: number
  gender: string
}

interface RegisteredPlayer {
  id: string
  user_id: string
  category: number
  status: string
  user: Player
}

export default function ManageIntercountryTeamPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<any>(null)
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [captainId, setCaptainId] = useState<string>('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCaptain, setIsCaptain] = useState(false)

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
    
    // Load tournament details
    const { data: tournamentData } = await supabase
      .from('intercountry_tournaments')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (tournamentData) {
      setTournament(tournamentData)
    }

    // Check if user is captain for this tournament
    const { data: participant } = await supabase
      .from('intercountry_participants')
      .select('*')
      .eq('tournament_id', params.id)
      .eq('club_id', user.club_id)
      .single()

    if (participant) {
      setTeamName(participant.club_name || '')
      setIsCaptain(participant.list_manager_id === user.id)
      if (participant.list_manager_id) {
        setCaptainId(participant.list_manager_id)
      }
    }

    // Load available players from user's club
    const { data: playersData } = await supabase
      .from('users')
      .select('id, name, member_number, category, rating, gender')
      .eq('club_id', user.club_id)
      .eq('status', 'active')
      .order('category', { ascending: true })
      .order('rating', { ascending: false })

    if (playersData) {
      setAvailablePlayers(playersData)
    }

    // Load already registered players for this tournament
    const { data: registeredData } = await supabase
      .from('intercountry_registrations')
      .select(`
        id,
        user_id,
        category,
        status,
        user:users (id, name, member_number, category, rating, gender)
      `)
      .eq('tournament_id', params.id)
      .eq('club_id', user.club_id)

    if (registeredData) {
      setRegisteredPlayers(registeredData as any)
      setSelectedPlayers(registeredData.map((r: any) => r.user_id))
    }

    setLoading(false)
  }

  function togglePlayerSelection(playerId: string) {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        // Remove player
        const newSelection = prev.filter(id => id !== playerId)
        // If captain was removed, clear captain
        if (captainId === playerId) {
          setCaptainId('')
        }
        return newSelection
      } else {
        // Add player
        return [...prev, playerId]
      }
    })
  }

  function setAsCaptain(playerId: string) {
    if (!selectedPlayers.includes(playerId)) {
      // Auto-select if not selected
      setSelectedPlayers(prev => [...prev, playerId])
    }
    setCaptainId(playerId)
  }

  async function saveTeam() {
    console.log('DEBUG: saveTeam called, user:', user)
    
    if (!user || (!isAdmin && !isCaptain)) {
      console.log('DEBUG: Early return - no user or no permissions')
      return
    }
    
    console.log('DEBUG: Proceeding with save (RLS disabled)...')
    setSaving(true)

    // Get current registrations to determine what to add/remove
    const currentRegistrations = registeredPlayers.map(r => r.user_id)
    
    // Players to add
    const toAdd = selectedPlayers.filter(id => !currentRegistrations.includes(id))
    
    // Players to remove
    const toRemove = currentRegistrations.filter(id => !selectedPlayers.includes(id))

    // Add new registrations
    for (const playerId of toAdd) {
      const player = availablePlayers.find(p => p.id === playerId)
      if (player) {
        const insertData = {
          tournament_id: params.id,
          club_id: user.club_id,
          user_id: playerId,
          category: player.category || 5, // Default to 5 if null
          status: 'active'
        }
        
        console.log('DEBUG: Inserting registration:', insertData)
        
        try {
          const { data, error } = await supabase
            .from('intercountry_registrations')
            .insert(insertData)
            .select()
          
          if (error) {
            console.error('DEBUG: Insert error:', error)
          } else {
            console.log('DEBUG: Insert success:', data)
          }
        } catch (err) {
          console.error('DEBUG: Insert exception:', err)
        }
      }
    }

    // Remove unselected registrations
    for (const playerId of toRemove) {
      await supabase
        .from('intercountry_registrations')
        .delete()
        .eq('tournament_id', params.id)
        .eq('club_id', user.club_id)
        .eq('user_id', playerId)
    }

    // Update captain in intercountry_participants
    try {
      const { data, error } = await supabase
        .from('intercountry_participants')
        .update({ 
          list_manager_id: captainId || null
        })
        .eq('tournament_id', params.id)
        .eq('club_id', user.club_id)
      
      if (error) {
        console.error('DEBUG: Participants update error:', error)
      } else {
        console.log('DEBUG: Participants update success:', data)
      }
    } catch (err) {
      console.error('DEBUG: Participants update exception:', err)
    }

    // Reload data
    await loadData()
    setSaving(false)
    alert('Equipo guardado correctamente')
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

  if (!isAdmin && !isCaptain) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">No tenés permisos para gestionar este equipo.</p>
            <p className="text-red-300 text-sm mt-2">Solo el capitán o un administrador pueden gestionar los jugadores.</p>
          </div>
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
              <Link href={`/intercountry/${params.id}`} className="text-purple-200 hover:text-white transition-colors">
                ← Volver
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              👥 Gestionar Equipo
            </h1>
            <p className="text-purple-100 text-lg">
              {tournament?.name || 'Torneo Intercountry'}
            </p>
          </div>
        </div>

        {/* Tournament Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <div className="flex flex-wrap gap-4 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <span>📅</span> Temporada: {tournament?.season}
            </span>
            <span className="flex items-center gap-2">
              <span>🏆</span> Categoría: {tournament?.category}°
            </span>
            <span className="flex items-center gap-2">
              <span>👥</span> Género: {tournament?.gender === 'male' ? 'Masculino' : tournament?.gender === 'female' ? 'Femenino' : 'Mixto'}
            </span>
          </div>
        </div>

        {/* Team Configuration */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚙️</span> Configuración del Equipo
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nombre del Equipo (opcional)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Ej: Padel Club Centro A"
              className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {captainId && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-400">
                <span className="font-semibold">Capitán designado:</span>{' '}
                {availablePlayers.find(p => p.id === captainId)?.name || 'No encontrado'}
              </p>
            </div>
          )}
        </div>

        {/* Players Selection */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>👥</span> Seleccionar Jugadores
            </h2>
            <div className="text-sm text-gray-400">
              Seleccionados: <span className="text-purple-400 font-bold">{selectedPlayers.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Seleccionar</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Jugador</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">N° Socio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Género</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {availablePlayers.map((player) => {
                  const isSelected = selectedPlayers.includes(player.id)
                  const isCaptain = captainId === player.id

                  return (
                    <tr key={player.id} className={isSelected ? 'bg-purple-500/20' : 'hover:bg-gray-700/50 transition-colors'}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="w-4 h-4 text-purple-600 rounded bg-gray-700 border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{player.name}</td>
                      <td className="px-4 py-3 text-gray-400">{player.member_number}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">{player.category}°</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{player.rating || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {player.gender === 'male' ? 'M' : player.gender === 'female' ? 'F' : 'O'}
                      </td>
                      <td className="px-4 py-3">
                        {isSelected && (
                          <button
                            onClick={() => setAsCaptain(player.id)}
                            disabled={isCaptain}
                            className={`px-3 py-1 rounded text-sm transition-all duration-300 ${
                              isCaptain
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-default'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
                            }`}
                          >
                            {isCaptain ? 'Capitán' : 'Designar Capitán'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {availablePlayers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">👥</p>
              <p>No hay jugadores disponibles en el club</p>
            </div>
          )}
        </div>

        {/* Selected Players Summary */}
        {selectedPlayers.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>✅</span> Jugadores Seleccionados ({selectedPlayers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedPlayers.map(playerId => {
                const player = availablePlayers.find(p => p.id === playerId)
                if (!player) return null
                const isCaptain = captainId === playerId

                return (
                  <div
                    key={playerId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all duration-300 hover:scale-105 ${
                      isCaptain ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}
                  >
                    <span>{player.name}</span>
                    <span className="text-xs opacity-75">({player.category}°)</span>
                    {isCaptain && <span className="text-xs font-bold">CAPITÁN</span>}
                    <button
                      onClick={() => togglePlayerSelection(playerId)}
                      className="ml-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={saveTeam}
            disabled={saving || selectedPlayers.length === 0}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105 font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar Equipo'}
          </button>

          <button
            onClick={() => router.push(`/intercountry/${params.id}/lista-buena-fe`)}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/25 transition-all duration-300 hover:scale-105 font-medium"
          >
            Lista de Buena Fe →
          </button>

          <button
            onClick={() => router.push(`/intercountry/${params.id}`)}
            className="bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors font-medium"
          >
            Volver
          </button>
        </div>
      </div>
    </MainLayout>
  )
}
