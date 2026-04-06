'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import Link from 'next/link'

interface RankingUser {
  id: string
  name: string
  rating: number
  total_matches: number
  win_rate: number
}

export default function RankingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [rankings, setRankings] = useState<RankingUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadRankings()
  }, [isLoading, isAuthenticated, router])

  async function loadRankings() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, rating, total_matches, win_rate')
        .or('role.eq.user,role.is.null')
        .order('rating', { ascending: false })

      if (error) {
        console.error('Error loading rankings:', error)
      } else {
        setRankings(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
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
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 Ranking General</h1>
          <p className="text-blue-100">Clasificación de jugadores del club</p>
        </div>

        {/* Rankings Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Posición</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Jugador</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Rating</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Partidos</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">% Victoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {rankings.length > 0 ? (
                  rankings.map((player, index) => (
                    <tr key={player.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/20 text-gray-300' :
                          index === 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-600/20 text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/compare?player=${player.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                          {player.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                          {player.rating}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-400">
                        {player.total_matches}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-semibold ${
                          player.win_rate >= 60 ? 'text-green-400' :
                          player.win_rate >= 40 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {player.win_rate}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <p className="text-4xl mb-2">🏓</p>
                      <p>No hay jugadores en el ranking aún</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
