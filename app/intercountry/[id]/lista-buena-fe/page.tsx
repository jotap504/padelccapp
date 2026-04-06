'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Player {
  id: string
  user_id: string
  name: string
  member_number: string
  category: number
  rating: number
  gender: string
  position: number | null
}

export default function ListaBuenaFePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
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
    
    // Load tournament
    const { data: tournamentData } = await supabase
      .from('intercountry_tournaments')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (tournamentData) {
      setTournament(tournamentData)
    }

    // Check if user is captain
    const { data: participant } = await supabase
      .from('intercountry_participants')
      .select('*')
      .eq('tournament_id', params.id)
      .eq('club_id', user.club_id)
      .single()

    if (participant) {
      setIsCaptain(participant.list_manager_id === user.id)
    }

    // Load registered players with positions
    const { data: registeredData } = await supabase
      .from('intercountry_registrations')
      .select(`
        id,
        user_id,
        category,
        status,
        position,
        user:users (id, name, member_number, category, rating, gender)
      `)
      .eq('tournament_id', params.id)
      .eq('club_id', user.club_id)
      .eq('status', 'active')

    if (registeredData) {
      const formattedPlayers = registeredData.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.user?.name || 'Sin nombre',
        member_number: r.user?.member_number || '-',
        category: r.user?.category || r.category,
        rating: r.user?.rating || 0,
        gender: r.user?.gender || 'male',
        position: r.position
      }))
      
      // Sort by position, then by category/rating
      formattedPlayers.sort((a: Player, b: Player) => {
        if (a.position && b.position) return a.position - b.position
        if (a.position) return -1
        if (b.position) return 1
        return (b.rating || 0) - (a.rating || 0)
      })
      
      setPlayers(formattedPlayers)
    }

    setLoading(false)
  }

  function updatePosition(playerId: string, position: number | null) {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, position } : p
    ))
  }

  async function savePositions() {
    if (!user || (!isAdmin && !isCaptain)) return
    
    setSaving(true)

    // Check for duplicate positions
    const positions = players.map(p => p.position).filter(p => p !== null) as number[]
    const duplicates = positions.filter((item, index) => positions.indexOf(item) !== index)
    
    if (duplicates.length > 0) {
      alert(`Posiciones duplicadas: ${duplicates.join(', ')}. Cada jugador debe tener una posición única.`)
      setSaving(false)
      return
    }

    // Update each player position
    for (const player of players) {
      const { error } = await supabase
        .from('intercountry_registrations')
        .update({ position: player.position })
        .eq('id', player.id)

      if (error) {
        console.error('Error updating position:', error)
      }
    }

    await loadData()
    setSaving(false)
    alert('Posiciones guardadas correctamente')
  }

  function autoAssignPositions() {
    // Sort by category (lower is better), then by rating (higher is better)
    const sorted = [...players].sort((a, b) => {
      if (a.category !== b.category) return a.category - b.category
      return (b.rating || 0) - (a.rating || 0)
    })

    // Assign positions 1-20
    const updated = sorted.map((p, index) => ({
      ...p,
      position: index < 20 ? index + 1 : null
    }))

    setPlayers(updated)
  }

  function clearPositions() {
    if (confirm('¿Eliminar todas las posiciones asignadas?')) {
      setPlayers(prev => prev.map(p => ({ ...p, position: null })))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Lista de Buena Fe" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin && !isCaptain) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Lista de Buena Fe" />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">No tenés permisos para ver esta página.</p>
            <p className="text-red-600 text-sm mt-2">Solo el capitán o un administrador pueden gestionar la lista.</p>
          </div>
        </div>
      </div>
    )
  }

  const assignedCount = players.filter(p => p.position !== null).length
  const availablePositions = Array.from({ length: 20 }, (_, i) => i + 1).filter(
    pos => !players.some(p => p.position === pos)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Lista de Buena Fe - ${tournament?.name || 'Intercountry'}`} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tournament Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament?.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Temporada: {tournament?.season}</span>
            <span>Categoría: {tournament?.category}°</span>
            <span>Jugadores: {players.length}</span>
            <span>Posiciones asignadas: {assignedCount}/20</span>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Asignación de Posiciones</h2>
              <p className="text-sm text-gray-600">
                Asigná posiciones del 1 al 20. Las posiciones 1-4 suelen ser las parejas principales.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={autoAssignPositions}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
              >
                Auto-asignar por categoría
              </button>
              <button
                onClick={clearPositions}
                className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 text-sm"
              >
                Limpiar posiciones
              </button>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Jugadores Registrados ({players.length})</h3>
          
          {players.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posición</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jugador</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Socio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Género</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {players.map((player) => (
                    <tr 
                      key={player.id} 
                      className={player.position ? 'bg-blue-50' : ''}
                    >
                      <td className="px-4 py-3">
                        <select
                          value={player.position || ''}
                          onChange={(e) => updatePosition(player.id, e.target.value ? parseInt(e.target.value) : null)}
                          className="w-20 border rounded px-2 py-1 text-center"
                        >
                          <option value="">-</option>
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(pos => (
                            <option 
                              key={pos} 
                              value={pos}
                              disabled={players.some(p => p.id !== player.id && p.position === pos)}
                            >
                              {pos}
                            </option>
                          ))}
                        </select>
                        {player.position && player.position <= 4 && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Principal
                          </span>
                        )}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay jugadores registrados. Primero debés seleccionar jugadores en "Gestionar Equipo".
            </p>
          )}
        </div>

        {/* Positions Summary */}
        {assignedCount > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Lista Ordenada (Posiciones Asignadas)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {players
                .filter(p => p.position !== null)
                .sort((a, b) => (a.position || 99) - (b.position || 99))
                .map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-4 rounded-lg border-2 ${
                      player.position && player.position <= 4 
                        ? 'border-yellow-400 bg-yellow-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-blue-600">#{player.position}</span>
                      {player.position && player.position <= 4 && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded font-bold">
                          PRINCIPAL
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{player.name}</p>
                    <p className="text-sm text-gray-600">
                      Cat {player.category}° • Rating {player.rating || '-'}
                    </p>
                    <p className="text-xs text-gray-500">Socio #{player.member_number}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Available Positions */}
        {availablePositions.length > 0 && (
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Posiciones disponibles:</span>{' '}
              {availablePositions.join(', ')}
            </p>
          </div>
        )}

        {/* Save Actions */}
        <div className="flex gap-4">
          <button
            onClick={savePositions}
            disabled={saving || players.length === 0}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar Posiciones'}
          </button>
          
          <button
            onClick={() => router.push(`/intercountry/${params.id}/manage`)}
            className="bg-gray-300 text-gray-700 px-6 py-3 rounded hover:bg-gray-400 font-medium"
          >
            Volver a Gestión de Equipo
          </button>

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
