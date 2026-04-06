'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

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
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestionar Equipo" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin && !isCaptain) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestionar Equipo" />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">No tenés permisos para gestionar este equipo.</p>
            <p className="text-red-600 text-sm mt-2">Solo el capitán o un administrador pueden gestionar los jugadores.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Gestionar Equipo - ${tournament?.name || 'Intercountry'}`} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tournament Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament?.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Temporada: {tournament?.season}</span>
            <span>Categoría: {tournament?.category}°</span>
            <span>Género: {tournament?.gender === 'male' ? 'Masculino' : tournament?.gender === 'female' ? 'Femenino' : 'Mixto'}</span>
          </div>
        </div>

        {/* Team Configuration */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Configuración del Equipo</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Equipo (opcional)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Ej: Padel Club Centro A"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {captainId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Capitán designado:</span>{' '}
                {availablePlayers.find(p => p.id === captainId)?.name || 'No encontrado'}
              </p>
            </div>
          )}
        </div>

        {/* Players Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Seleccionar Jugadores</h2>
            <div className="text-sm text-gray-600">
              Seleccionados: {selectedPlayers.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seleccionar</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jugador</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">N° Socio</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Género</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {availablePlayers.map((player) => {
                  const isSelected = selectedPlayers.includes(player.id)
                  const isCaptain = captainId === player.id

                  return (
                    <tr key={player.id} className={isSelected ? 'bg-green-50' : ''}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{player.name}</td>
                      <td className="px-4 py-3 text-gray-600">{player.member_number}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-sm">{player.category}°</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{player.rating || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {player.gender === 'male' ? 'M' : player.gender === 'female' ? 'F' : 'O'}
                      </td>
                      <td className="px-4 py-3">
                        {isSelected && (
                          <button
                            onClick={() => setAsCaptain(player.id)}
                            disabled={isCaptain}
                            className={`px-3 py-1 rounded text-sm ${
                              isCaptain
                                ? 'bg-yellow-100 text-yellow-800 cursor-default'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
            <p className="text-gray-500 text-center py-8">No hay jugadores disponibles en el club</p>
          )}
        </div>

        {/* Selected Players Summary */}
        {selectedPlayers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Jugadores Seleccionados ({selectedPlayers.length})</h3>
            <div className="flex flex-wrap gap-2">
              {selectedPlayers.map(playerId => {
                const player = availablePlayers.find(p => p.id === playerId)
                if (!player) return null
                const isCaptain = captainId === playerId
                
                return (
                  <div 
                    key={playerId} 
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                      isCaptain ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    <span>{player.name}</span>
                    <span className="text-xs opacity-75">({player.category}°)</span>
                    {isCaptain && <span className="text-xs font-bold">CAPITÁN</span>}
                    <button
                      onClick={() => togglePlayerSelection(playerId)}
                      className="ml-1 text-red-500 hover:text-red-700"
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
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar Equipo'}
          </button>
          
          <button
            onClick={() => router.push(`/intercountry/${params.id}/lista-buena-fe`)}
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-medium"
          >
            Lista de Buena Fe →
          </button>
          
          <button
            onClick={() => router.push(`/intercountry/${params.id}`)}
            className="bg-gray-300 text-gray-700 px-6 py-3 rounded hover:bg-gray-400 font-medium"
          >
            Volver
          </button>
        </div>
      </main>
    </div>
  )
}
