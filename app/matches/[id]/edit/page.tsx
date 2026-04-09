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
  format: '3' | '5'
}

export default function EditMatchPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const matchId = params?.id as string

  // Estado para los sets (null = vacío, más fácil para el UX)
  const [sets, setSets] = useState<Array<{ team_a: number | null; team_b: number | null }>>([
    { team_a: null, team_b: null },
    { team_a: null, team_b: null },
    { team_a: null, team_b: null }
  ])

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
        // Si ya hay sets, cargarlos (asegurar que siempre haya 3 sets)
        if (data.sets && data.sets.length > 0) {
          const loadedSets = [...data.sets]
          // Completar hasta 3 sets si faltan
          while (loadedSets.length < 3) {
            loadedSets.push({ team_a: 0, team_b: 0 })
          }
          setSets(loadedSets)
        }
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error al cargar el partido')
    } finally {
      setLoading(false)
    }
  }

  function updateSet(index: number, team: 'a' | 'b', value: number | null) {
    const newSets = [...sets]
    newSets[index] = {
      ...newSets[index],
      [team === 'a' ? 'team_a' : 'team_b']: value
    }
    setSets(newSets)
  }

  // Validar puntuación de tenis
  function isValidTennisSet(gamesA: number | null, gamesB: number | null): boolean {
    if (gamesA === null || gamesB === null) return true // Vacío es válido
    
    const a = gamesA
    const b = gamesB
    
    // Set normal: ganar 6 con diferencia de 2
    if (a === 6 && b <= 4) return true
    if (b === 6 && a <= 4) return true
    
    // 7-5 o 7-6 (tiebreak)
    if (a === 7 && (b === 5 || b === 6)) return true
    if (b === 7 && (a === 5 || a === 6)) return true
    
    return false
  }

  function getSetError(gamesA: number | null, gamesB: number | null): string | null {
    if (gamesA === null || gamesB === null) return null
    if (!isValidTennisSet(gamesA, gamesB)) {
      return 'Puntuación inválida. Válido: 6-0 a 6-4, 7-5, 7-6'
    }
    return null
  }

  async function saveResult() {
    if (!match || !user) return

    setSaving(true)
    try {
      // Agregar ID del usuario a validated_by (si no está ya)
      const currentValidated = match.validated_by || []
      const newValidated = currentValidated.includes(user.id) 
        ? currentValidated 
        : [...currentValidated, user.id]

      const { error } = await supabase
        .from('matches')
        .update({
          sets: sets
            .filter(s => (s.team_a ?? 0) > 0 || (s.team_b ?? 0) > 0)
            .map(s => ({ team_a: s.team_a ?? 0, team_b: s.team_b ?? 0 })),
          validated_by: newValidated,
          status: newValidated.length >= 2 ? 'confirmed' : 'pending'
        })
        .eq('id', matchId)

      if (error) {
        console.error('Error saving result:', error)
        setError('Error al guardar el resultado')
      } else {
        router.push(`/matches/${matchId}`)
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error al guardar el resultado')
    } finally {
      setSaving(false)
    }
  }

  function calculateWinner() {
    let teamASets = 0
    let teamBSets = 0
    
    sets.forEach(set => {
      const a = set.team_a ?? 0
      const b = set.team_b ?? 0
      if (a > b) teamASets++
      else if (b > a) teamBSets++
    })
    
    if (teamASets >= 2) return 'A'
    if (teamBSets >= 2) return 'B'
    return null
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">✏️ Registrar Resultado</h1>
          <p className="text-blue-100">
            {new Date(match.date).toLocaleDateString('es-AR')}
          </p>
        </div>

        {/* Match Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          {/* Teams */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="text-center">
              <h3 className="text-lg font-bold text-blue-400 mb-2">Equipo A</h3>
              <p className="text-gray-300">
                {match.team_a?.map(p => p.name).join(' + ')}
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-red-400 mb-2">Equipo B</h3>
              <p className="text-gray-300">
                {match.team_b?.map(p => p.name).join(' + ')}
              </p>
            </div>
          </div>

          {/* Sets Input */}
          <h3 className="text-xl font-bold text-white mb-4 text-center">Ingresar Sets</h3>
          
          <div className="space-y-4">
            {sets.map((set, index) => (
              <div key={index} className="flex items-center justify-center gap-4">
                <span className="text-gray-400 w-16">Set {index + 1}</span>
                
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-sm">A</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={set.team_a ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      updateSet(index, 'a', val === '' ? null : parseInt(val))
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <span className="text-gray-500">-</span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={set.team_b ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      updateSet(index, 'b', val === '' ? null : parseInt(val))
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-red-400 text-sm">B</span>
                </div>
                {getSetError(set.team_a, set.team_b) && (
                  <span className="text-red-400 text-xs">{getSetError(set.team_a, set.team_b)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Preview Winner */}
          {winner && (
            <div className="mt-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
              <p className="text-green-400 font-bold text-lg">
                🏆 Ganador: Equipo {winner}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                El resultado se guardará como confirmado
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Link 
            href={`/matches/${matchId}`}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Cancelar
          </Link>
          
          <button
            onClick={saveResult}
            disabled={saving || !winner}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar Resultado'}
          </button>
        </div>
      </div>
    </MainLayout>
  )
}
