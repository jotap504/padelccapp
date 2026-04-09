'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'
import Link from 'next/link'

interface Match {
  id: string
  date: string
  status: string
  team_a: Array<{ user_id: string; name: string }>
  team_b: Array<{ user_id: string; name: string }>
  sets: Array<{ team_a: number; team_b: number }>
  validated_by: string[]
  created_by: string
}

export default function MatchDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const matchId = params?.id as string

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadMatch()
  }, [isLoading, isAuthenticated, matchId, router])

  async function loadMatch() {
    if (!matchId) return
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (error) {
        console.error('Error loading match:', error)
        setError('Partido no encontrado')
      } else {
        setMatch(data)
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error al cargar el partido')
    } finally {
      setLoading(false)
    }
  }

  function calculateWinner() {
    if (!match?.sets || match.sets.length === 0) return null
    
    let teamASets = 0
    let teamBSets = 0
    
    match.sets.forEach(set => {
      if (set.team_a > set.team_b) teamASets++
      else if (set.team_b > set.team_a) teamBSets++
    })
    
    return teamASets > teamBSets ? 'A' : 'B'
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

  if (error || !match) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-4xl mb-4">🏓</p>
          <p className="text-xl text-gray-400">{error || 'Partido no encontrado'}</p>
          <Link 
            href="/matches" 
            className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a Partidos
          </Link>
        </div>
      </MainLayout>
    )
  }

  const winner = calculateWinner()
  const isValidated = match.validated_by?.length >= 2

  // Verificar si el usuario puede cargar resultado (es participante o admin)
  const canLoadResult = user && (
    user.role === 'admin' ||
    match.team_a?.some(p => p.user_id === user.id) ||
    match.team_b?.some(p => p.user_id === user.id)
  )

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">🏓 Detalles del Partido</h1>
          <p className="text-blue-100">{new Date(match.date).toLocaleDateString('es-AR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>

        {/* Match Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              match.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
              match.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
              match.status === 'disputed' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {match.status === 'confirmed' ? '✓ Confirmado' :
               match.status === 'pending' ? '⏳ Pendiente' :
               match.status === 'disputed' ? '⚠️ Disputado' :
               match.status}
            </span>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Team A */}
            <div className={`p-6 rounded-xl ${
              winner === 'A' ? 'bg-green-500/10 border-2 border-green-500/30' : 'bg-gray-700/50'
            }`}>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                Equipo A
                {winner === 'A' && <span className="text-2xl">🏆</span>}
              </h3>
              <div className="space-y-2">
                {match.team_a?.map((player, index) => (
                  <div key={index} className="flex items-center gap-2 text-gray-300">
                    <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {player.name?.charAt(0) || '?'}
                    </span>
                    {player.name || 'Jugador'}
                  </div>
                ))}
              </div>
            </div>

            {/* Team B */}
            <div className={`p-6 rounded-xl ${
              winner === 'B' ? 'bg-green-500/10 border-2 border-green-500/30' : 'bg-gray-700/50'
            }`}>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                Equipo B
                {winner === 'B' && <span className="text-2xl">🏆</span>}
              </h3>
              <div className="space-y-2">
                {match.team_b?.map((player, index) => (
                  <div key={index} className="flex items-center gap-2 text-gray-300">
                    <span className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm">
                      {player.name?.charAt(0) || '?'}
                    </span>
                    {player.name || 'Jugador'}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex justify-center my-6">
            <span className="text-2xl font-bold text-gray-500">VS</span>
          </div>

          {/* Sets Results */}
          {match.sets && match.sets.length > 0 && match.sets.some(s => s.team_a > 0 || s.team_b > 0) ? (
            <div className="mt-8">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Resultado por Sets</h3>
              <div className="flex justify-center gap-4 flex-wrap">
                {match.sets.map((set, index) => (
                  <div 
                    key={index} 
                    className={`px-6 py-4 rounded-xl font-bold text-lg ${
                      set.team_a > set.team_b 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                        : set.team_b > set.team_a
                        ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                        : 'bg-gray-600/20 text-gray-400'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">Set {index + 1}</div>
                    <div className="text-2xl">
                      {set.team_a} - {set.team_b}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <p className="text-gray-400">Resultado no registrado</p>
            </div>
          )}

          {/* Validation Status */}
          <div className="mt-8 p-4 bg-gray-700/30 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Validaciones</h4>
            <p className="text-gray-400">
              {isValidated 
                ? '✓ Partido validado por ambos equipos' 
                : `⏳ Validado por ${match.validated_by?.length || 0} de 2 equipos`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Link 
            href="/matches" 
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Volver a Partidos
          </Link>
          
          {canLoadResult && match.status === 'pending' && (
            <Link 
              href={`/matches/${match.id}/edit`}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📝 Cargar Resultado
            </Link>
          )}
          
          {canLoadResult && match.status === 'confirmed' && (
            <Link 
              href={`/matches/${match.id}/edit`}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              ✏️ Editar Resultado
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
