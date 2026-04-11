'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import Link from 'next/link'

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
            <p className="text-red-400">No tenés permisos para ver esta página.</p>
            <p className="text-red-300 text-sm mt-2">Solo el capitán o un administrador pueden gestionar la lista.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const assignedCount = players.filter(p => p.position !== null).length
  const availablePositions = Array.from({ length: 20 }, (_, i) => i + 1).filter(
    pos => !players.some(p => p.position === pos)
  )

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
              📋 Lista de Buena Fe
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
              <span>👥</span> Jugadores: {players.length}
            </span>
            <span className="flex items-center gap-2">
              <span>🔢</span> Posiciones asignadas: <span className="text-purple-400 font-bold">{assignedCount}/20</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>⚙️</span> Asignación de Posiciones
              </h2>
              <p className="text-sm text-gray-400">
                Asigná posiciones del 1 al 20. Las posiciones 1-4 suelen ser las parejas principales.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={autoAssignPositions}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105 text-sm"
              >
                Auto-asignar por categoría
              </button>
              <button
                onClick={clearPositions}
                className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
              >
                Limpiar posiciones
              </button>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>👥</span> Jugadores Registrados ({players.length})
          </h3>

          {players.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Posición</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Jugador</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">N° Socio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Género</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {players.map((player) => (
                    <tr
                      key={player.id}
                      className={player.position ? 'bg-purple-500/20' : 'hover:bg-gray-700/50 transition-colors'}
                    >
                      <td className="px-4 py-3">
                        <select
                          value={player.position || ''}
                          onChange={(e) => updatePosition(player.id, e.target.value ? parseInt(e.target.value) : null)}
                          className="w-20 border border-gray-600 rounded px-2 py-1 text-center bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                          <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded">
                            Principal
                          </span>
                        )}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">👥</p>
              <p>No hay jugadores registrados. Primero debés seleccionar jugadores en "Gestionar Equipo".</p>
            </div>
          )}
        </div>

        {/* Positions Summary */}
        {assignedCount > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📊</span> Lista Ordenada (Posiciones Asignadas)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {players
                .filter(p => p.position !== null)
                .sort((a, b) => (a.position || 99) - (b.position || 99))
                .map((player) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                      player.position && player.position <= 4
                        ? 'border-yellow-500/50 bg-yellow-500/10'
                        : 'border-gray-700 bg-gray-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-purple-400">#{player.position}</span>
                      {player.position && player.position <= 4 && (
                        <span className="text-xs bg-yellow-500/30 text-yellow-400 border border-yellow-500/50 px-2 py-1 rounded font-bold">
                          PRINCIPAL
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-white">{player.name}</p>
                    <p className="text-sm text-gray-400">
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
          <div className="bg-gray-700/30 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-gray-300">Posiciones disponibles:</span>{' '}
              <span className="text-purple-400">{availablePositions.join(', ')}</span>
            </p>
          </div>
        )}

        {/* Save Actions */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={savePositions}
            disabled={saving || players.length === 0}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105 font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar Posiciones'}
          </button>

          <button
            onClick={() => router.push(`/intercountry/${params.id}/manage`)}
            className="bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors font-medium"
          >
            Volver a Gestión de Equipo
          </button>

          <button
            onClick={() => router.push(`/intercountry/${params.id}`)}
            className="bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors font-medium"
          >
            Volver al Torneo
          </button>
        </div>
      </div>
    </MainLayout>
  )
}
