'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface PlayerStatus {
  current_category: number
  matches_in_category: number
  wins_same_level: number
  wins_higher_level: number
  total_wins: number
  rating: number
  total_matches: number
  win_rate: number
}

const categories = [
  { number: 8, name: '8va', color: 'from-gray-600 to-gray-700' },
  { number: 7, name: '7ma', color: 'from-purple-600 to-purple-700' },
  { number: 6, name: '6ta', color: 'from-blue-600 to-blue-700' },
  { number: 5, name: '5ta', color: 'from-green-600 to-green-700' },
  { number: 4, name: '4ta', color: 'from-yellow-600 to-yellow-700' },
  { number: 3, name: '3ra', color: 'from-orange-600 to-orange-700' },
  { number: 2, name: '2da', color: 'from-red-600 to-red-700' },
  { number: 1, name: '1ra', color: 'from-yellow-500 to-yellow-600' }
]

const defaultRequirements = {
  8: { matches_won_same_level: 25, matches_won_higher_level: 8, min_total_matches: 35, min_win_rate: 60, min_rating: 600 },
  7: { matches_won_same_level: 25, matches_won_higher_level: 8, min_total_matches: 35, min_win_rate: 62, min_rating: 700 },
  6: { matches_won_same_level: 28, matches_won_higher_level: 10, min_total_matches: 40, min_win_rate: 65, min_rating: 800 },
  5: { matches_won_same_level: 28, matches_won_higher_level: 10, min_total_matches: 40, min_win_rate: 65, min_rating: 900 },
  4: { matches_won_same_level: 30, matches_won_higher_level: 12, min_total_matches: 45, min_win_rate: 68, min_rating: 1050 },
  3: { matches_won_same_level: 30, matches_won_higher_level: 12, min_total_matches: 45, min_win_rate: 70, min_rating: 1200 },
  2: { matches_won_same_level: 35, matches_won_higher_level: 15, min_total_matches: 50, min_win_rate: 75, min_rating: 1350 }
}

export default function PromotionProgress() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrationNeeded, setMigrationNeeded] = useState(true)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return
    loadPlayerStatus()
  }, [isLoading, isAuthenticated, user])

  async function loadPlayerStatus() {
    if (!user) return

    try {
      const { data: statusData, error: statusError } = await supabase
        .from('player_category_status')
        .select('*')
        .eq('player_id', user.id)
        .single()

      if (statusError && statusError.code !== 'PGRST116') {
        console.error('Error loading player status:', statusError)
      }

      const { data: userData } = await supabase
        .from('users')
        .select('rating, total_matches, win_rate')
        .eq('id', user.id)
        .single()

      if (userData) {
        const status: PlayerStatus = {
          current_category: statusData?.current_category || 8,
          matches_in_category: statusData?.matches_in_category || userData.total_matches || 0,
          wins_same_level: statusData?.wins_same_level || Math.floor((userData.total_matches || 0) * (userData.win_rate || 0) / 100 * 0.7),
          wins_higher_level: statusData?.wins_higher_level || Math.floor((userData.total_matches || 0) * (userData.win_rate || 0) / 100 * 0.3),
          total_wins: Math.floor((userData.total_matches || 0) * (userData.win_rate || 0) / 100),
          rating: userData.rating || 1500,
          total_matches: userData.total_matches || 0,
          win_rate: userData.win_rate || 0
        }
        setPlayerStatus(status)
        setMigrationNeeded(!statusData)
      }
    } catch (error) {
      console.error('Error loading promotion progress:', error)
      setMigrationNeeded(true)
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

  const currentCategory = categories.find(cat => cat.number === playerStatus?.current_category)
  const nextCategory = categories.find(cat => cat.number === (playerStatus?.current_category || 8) - 1)
  const requirements = playerStatus ? defaultRequirements[playerStatus.current_category as keyof typeof defaultRequirements] : null

  const progress = requirements ? {
    matches_won_same_level: {
      current: playerStatus?.wins_same_level || 0,
      required: requirements.matches_won_same_level,
      completed: (playerStatus?.wins_same_level || 0) >= requirements.matches_won_same_level
    },
    matches_won_higher_level: {
      current: playerStatus?.wins_higher_level || 0,
      required: requirements.matches_won_higher_level,
      completed: (playerStatus?.wins_higher_level || 0) >= requirements.matches_won_higher_level
    },
    min_total_matches: {
      current: playerStatus?.matches_in_category || 0,
      required: requirements.min_total_matches,
      completed: (playerStatus?.matches_in_category || 0) >= requirements.min_total_matches
    },
    min_win_rate: {
      current: playerStatus?.win_rate || 0,
      required: requirements.min_win_rate,
      completed: (playerStatus?.win_rate || 0) >= requirements.min_win_rate
    },
    min_rating: {
      current: playerStatus?.rating || 0,
      required: requirements.min_rating,
      completed: (playerStatus?.rating || 0) >= requirements.min_rating
    }
  } : null

  const allRequirementsMet = progress ? Object.values(progress).every(p => p.completed) : false

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">📈 Progreso de Ascenso</h1>
          <p className="text-indigo-100">Tu camino hacia la siguiente categoría</p>
        </div>

        {migrationNeeded && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <div className="font-bold text-yellow-400">Configuración de Ascensos Pendiente</div>
                <div className="text-sm text-yellow-300">
                  El administrador necesita ejecutar la migración de la base de datos para activar el sistema completo de ascensos.
                  Mientras tanto, mostramos información básica con requisitos predeterminados.
                </div>
              </div>
            </div>
          </div>
        )}

        {playerStatus && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Estado Actual</h2>
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${currentCategory?.color} text-white font-bold`}>
                    {currentCategory?.name} Categoría
                  </div>
                  <div className="text-gray-300">
                    <div className="text-sm">Rating: <span className="font-bold">{playerStatus.rating}</span></div>
                    <div className="text-sm">Win Rate: <span className="font-bold">{playerStatus.win_rate}%</span></div>
                  </div>
                </div>
              </div>
              
              {nextCategory && (
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">Siguiente categoría</div>
                  <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${nextCategory.color} text-white font-bold`}>
                    {nextCategory.name}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">{playerStatus.matches_in_category}</div>
                <div className="text-sm text-gray-400">Partidos en categoría</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{playerStatus.wins_same_level}</div>
                <div className="text-sm text-gray-400">Victorias mismo nivel</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">{playerStatus.wins_higher_level}</div>
                <div className="text-sm text-gray-400">Victorias nivel superior</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-400">{playerStatus.total_wins}</div>
                <div className="text-sm text-gray-400">Total victorias</div>
              </div>
            </div>
          </div>
        )}

        {progress && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">
              {allRequirementsMet ? '🎉 ¡Elegible para Ascenso!' : '📋 Requisitos para Ascender'}
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    progress.matches_won_same_level.completed 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {progress.matches_won_same_level.completed ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-medium text-white">Victorias vs mismo nivel</div>
                    <div className="text-sm text-gray-400">
                      {progress.matches_won_same_level.required - progress.matches_won_same_level.current > 0 
                        ? `Necesitas ${progress.matches_won_same_level.required - progress.matches_won_same_level.current} más` 
                        : 'Completado'}
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-300">
                  {progress.matches_won_same_level.current} / {progress.matches_won_same_level.required}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    progress.matches_won_higher_level.completed 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {progress.matches_won_higher_level.completed ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-medium text-white">Victorias vs nivel superior</div>
                    <div className="text-sm text-gray-400">
                      {progress.matches_won_higher_level.required - progress.matches_won_higher_level.current > 0 
                        ? `Necesitas ${progress.matches_won_higher_level.required - progress.matches_won_higher_level.current} más` 
                        : 'Completado'}
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-300">
                  {progress.matches_won_higher_level.current} / {progress.matches_won_higher_level.required}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    progress.min_total_matches.completed 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {progress.min_total_matches.completed ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-medium text-white">Total de partidos</div>
                    <div className="text-sm text-gray-400">
                      {progress.min_total_matches.required - progress.min_total_matches.current > 0 
                        ? `Necesitas ${progress.min_total_matches.required - progress.min_total_matches.current} más` 
                        : 'Completado'}
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-300">
                  {progress.min_total_matches.current} / {progress.min_total_matches.required}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    progress.min_win_rate.completed 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {progress.min_win_rate.completed ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-medium text-white">Porcentaje de victorias</div>
                    <div className="text-sm text-gray-400">
                      {progress.min_win_rate.required - progress.min_win_rate.current > 0 
                        ? `Necesitas ${(progress.min_win_rate.required - progress.min_win_rate.current).toFixed(1)}% más` 
                        : 'Completado'}
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-300">
                  {progress.min_win_rate.current}% / {progress.min_win_rate.required}%
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    progress.min_rating.completed 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {progress.min_rating.completed ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-medium text-white">Rating mínimo</div>
                    <div className="text-sm text-gray-400">
                      {progress.min_rating.required - progress.min_rating.current > 0 
                        ? `Necesitas ${progress.min_rating.required - progress.min_rating.current} puntos más` 
                        : 'Completado'}
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-300">
                  {progress.min_rating.current} / {progress.min_rating.required}
                </div>
              </div>
            </div>

            {allRequirementsMet && (
              <div className="mt-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🎉</div>
                  <div>
                    <div className="font-bold text-green-400">¡Felicidades! Elegible para ascenso</div>
                    <div className="text-sm text-green-300">
                      Un administrador revisará tu caso y procesará el ascenso pronto.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-400 mb-3">💡 Consejos para ascender más rápido</h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400">•</span>
              <span>Ganar contra jugadores de categoría superior acelera tu ascenso (cuenta doble)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">•</span>
              <span>Mantén un porcentaje de victorias alto para cumplir los requisitos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">•</span>
              <span>Sé constante - juega regularmente para acumular experiencia</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">•</span>
              <span>Los partidos perdidos también suman puntos, ¡no te desanimes!</span>
            </li>
          </ul>
        </div>
      </div>
    </MainLayout>
  )
}
