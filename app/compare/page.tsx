'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'
import PlayerSearchSelect from '@/app/components/PlayerSearchSelect'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Player {
  id: string
  name: string
  category: number | null
  rating: number | null
  total_matches: number
  win_rate: number | null
  handedness: string | null
  preferred_side: string | null
}

export default function ComparePlayersPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [players, setPlayers] = useState<Player[]>([])
  const [player1, setPlayer1] = useState<Player | null>(null)
  const [player2, setPlayer2] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadPlayers()
  }, [isLoading, isAuthenticated])

  async function loadPlayers() {
    if (!user) return
    
    const { data } = await supabase
      .from('users')
      .select('id, name, category, rating, total_matches, win_rate, handedness, preferred_side')
      .eq('club_id', user.club_id)
      .eq('status', 'active')
      .order('rating', { ascending: false })
    
    if (data) setPlayers(data)
    setLoading(false)
  }

  // Helper to get full player data from id
  const getPlayerById = (id: string) => players.find(p => p.id === id) || null

  const handlePlayer1Select = (id: string) => {
    setPlayer1(getPlayerById(id))
  }

  const handlePlayer2Select = (id: string) => {
    setPlayer2(getPlayerById(id))
  }

  const getCategoryColor = (cat: number | null) => {
    if (!cat) return 'bg-gray-100 text-gray-800'
    const colors: Record<number, string> = {
      1: 'bg-purple-100 text-purple-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-cyan-100 text-cyan-800',
      4: 'bg-green-100 text-green-800',
      5: 'bg-yellow-100 text-yellow-800',
      6: 'bg-orange-100 text-orange-800',
      7: 'bg-red-100 text-red-800',
      8: 'bg-gray-100 text-gray-800'
    }
    return colors[cat] || 'bg-gray-100 text-gray-800'
  }

  const comparisonData = player1 && player2 ? [
    { name: 'Rating', player1: player1.rating || 0, player2: player2.rating || 0 },
    { name: 'Partidos', player1: player1.total_matches, player2: player2.total_matches },
    { name: '% Victoria', player1: player1.win_rate || 0, player2: player2.win_rate || 0 },
  ] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Comparar Jugadores" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Comparar Jugadores" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Player Selectors */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Player 1 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Jugador 1</h2>
            {!player1 ? (
              <PlayerSearchSelect
                players={players}
                value=""
                onChange={handlePlayer1Select}
                placeholder="Buscar jugador..."
                excludeIds={player2 ? [player2.id] : []}
              />
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600 mx-auto mb-2">
                  {player1.name.charAt(0)}
                </div>
                <p className="font-semibold">{player1.name}</p>
                <p className="text-sm text-gray-500">{player1.rating} pts • {player1.total_matches} partidos</p>
                <button 
                  onClick={() => setPlayer1(null)}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Jugador 2</h2>
            {!player2 ? (
              <PlayerSearchSelect
                players={players}
                value=""
                onChange={handlePlayer2Select}
                placeholder="Buscar jugador..."
                excludeIds={player1 ? [player1.id] : []}
              />
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-2xl font-bold text-green-600 mx-auto mb-2">
                  {player2.name.charAt(0)}
                </div>
                <p className="font-semibold">{player2.name}</p>
                <p className="text-sm text-gray-500">{player2.rating} pts • {player2.total_matches} partidos</p>
                <button 
                  onClick={() => setPlayer2(null)}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Results */}
        {player1 && player2 && (
          <div className="space-y-6">
            {/* Stats Comparison */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Comparación Visual</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="player1" name={player1.name} fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="player2" name={player2.name} fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Comparison Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Estadística</th>
                    <th className="px-6 py-3 text-center text-sm font-medium text-blue-600">{player1.name}</th>
                    <th className="px-6 py-3 text-center text-sm font-medium text-green-600">{player2.name}</th>
                    <th className="px-6 py-3 text-center text-sm font-medium text-gray-500">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Rating</td>
                    <td className="px-6 py-4 text-center font-medium">{player1.rating || '-'}</td>
                    <td className="px-6 py-4 text-center font-medium">{player2.rating || '-'}</td>
                    <td className={`px-6 py-4 text-center font-medium ${(player1.rating || 0) > (player2.rating || 0) ? 'text-blue-600' : 'text-green-600'}`}>
                      {((player1.rating || 0) - (player2.rating || 0)) > 0 ? '+' : ''}{((player1.rating || 0) - (player2.rating || 0))}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Categoría</td>
                    <td className="px-6 py-4 text-center">{player1.category}°</td>
                    <td className="px-6 py-4 text-center">{player2.category}°</td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {player1.category && player2.category ? (player1.category - player2.category) : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Partidos Jugados</td>
                    <td className="px-6 py-4 text-center">{player1.total_matches}</td>
                    <td className="px-6 py-4 text-center">{player2.total_matches}</td>
                    <td className={`px-6 py-4 text-center ${player1.total_matches > player2.total_matches ? 'text-blue-600' : 'text-green-600'}`}>
                      {player1.total_matches - player2.total_matches > 0 ? '+' : ''}{player1.total_matches - player2.total_matches}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">% Victoria</td>
                    <td className="px-6 py-4 text-center">{player1.win_rate || 0}%</td>
                    <td className="px-6 py-4 text-center">{player2.win_rate || 0}%</td>
                    <td className={`px-6 py-4 text-center ${(player1.win_rate || 0) > (player2.win_rate || 0) ? 'text-blue-600' : 'text-green-600'}`}>
                      {((player1.win_rate || 0) - (player2.win_rate || 0)) > 0 ? '+' : ''}{((player1.win_rate || 0) - (player2.win_rate || 0)).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Mano</td>
                    <td className="px-6 py-4 text-center">{player1.handedness === 'right' ? 'Diestro' : player1.handedness === 'left' ? 'Zurdo' : '-'}</td>
                    <td className="px-6 py-4 text-center">{player2.handedness === 'right' ? 'Diestro' : player2.handedness === 'left' ? 'Zurdo' : '-'}</td>
                    <td className="px-6 py-4 text-center text-gray-500">-</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Lado Preferido</td>
                    <td className="px-6 py-4 text-center">{player1.preferred_side === 'drive' ? 'Drive' : player1.preferred_side === 'backhand' ? 'Revés' : player1.preferred_side === 'both' ? 'Ambos' : '-'}</td>
                    <td className="px-6 py-4 text-center">{player2.preferred_side === 'drive' ? 'Drive' : player2.preferred_side === 'backhand' ? 'Revés' : player2.preferred_side === 'both' ? 'Ambos' : '-'}</td>
                    <td className="px-6 py-4 text-center text-gray-500">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* View Profiles Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => router.push(`/players/${player1.id}`)}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ver Perfil de {player1.name}
              </button>
              <button
                onClick={() => router.push(`/players/${player2.id}`)}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Ver Perfil de {player2.name}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
