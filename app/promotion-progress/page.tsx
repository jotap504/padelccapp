'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface PlayerProgress {
  current_category: number
  current_points: number
  total_matches: number
  total_wins: number
  effectiveness_rate: number
  last_match_date: string
  points_needed: number
  requirements_met: {
    points: boolean
    matches_won_same_level: boolean
    min_total_matches: boolean
    min_win_rate: boolean
  }
  missing_requirements: {
    points: number
    matches_won_same_level: number
    min_total_matches: number
    min_win_rate: number
  }
}

interface CategoryConfig {
  category_points_max: number
  points_per_win: number
  points_per_loss: number
  bonus_superior_category: number
  points_decay_months: number
  matches_won_same_level: number
  matches_won_higher_level: number
  min_total_matches: number
  min_win_rate: number
}

const categories = [
  { number: 1, name: '1ra' },
  { number: 2, name: '2da' },
  { number: 3, name: '3ra' },
  { number: 4, name: '4ta' },
  { number: 5, name: '5ta' },
  { number: 6, name: '6ta' },
  { number: 7, name: '7ma' },
  { number: 8, name: '8va' }
]

export default function PromotionProgressPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [progress, setProgress] = useState<PlayerProgress | null>(null)
  const [config, setConfig] = useState<CategoryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return
    loadProgress()
  }, [isLoading, isAuthenticated])

  async function loadProgress() {
    try {
      // Validar que el user.id no sea un placeholder
      if (!user?.id || user.id === '11111111-1111-1111-1111-111111111111') {
        setError('Error: Sesión inválida. Por favor cerrá sesión y volvé a ingresar.')
        setLoading(false)
        return
      }

      // Obtener puntos actuales del jugador
      const { data: playerData, error: playerError } = await supabase
        .from('player_category_points')
        .select('*')
        .eq('player_id', user?.id)
        .single()

      if (playerError && playerError.code !== 'PGRST116') {
        throw playerError
      }

      // Obtener configuración de la categoría actual
      const currentCategory = playerData?.current_category || 8
      const { data: configData, error: configError } = await supabase
        .from('category_promotion_requirements')
        .select('*')
        .eq('from_category', currentCategory)
        .single()

      if (configError && configError.code !== 'PGRST116') {
        throw configError
      }

      // Verificar elegibilidad para ascenso
      const { data: eligibilityData, error: eligibilityError } = await supabase
        .rpc('check_promotion_eligibility_enhanced', {
          p_player_id: user?.id,
          p_club_id: playerData?.club_id || '67a5b532-879c-4ae0-9b79-68f50d2f12e3'
        })

      if (eligibilityError) {
        throw eligibilityError
      }

      const eligibility = eligibilityData[0]

      setProgress({
        current_category: currentCategory,
        current_points: playerData?.current_points || 0,
        total_matches: playerData?.total_matches || 0,
        total_wins: playerData?.total_wins || 0,
        effectiveness_rate: playerData?.effectiveness_rate || 0,
        last_match_date: playerData?.last_match_date || '',
        points_needed: eligibility.points_needed,
        requirements_met: eligibility.requirements_met,
        missing_requirements: eligibility.missing_requirements
      })

      setConfig(configData)
    } catch (error) {
      console.error('Error loading progress:', error)
      setError('No se pudieron cargar los datos de progreso')
    } finally {
      setLoading(false)
    }
  }

  function getCategoryName(category: number) {
    const cat = categories.find(c => c.number === category)
    return cat ? cat.name : `${category}ª`
  }

  function getNextCategoryName(category: number) {
    if (category <= 1) return 'Máxima'
    return getCategoryName(category - 1)
  }

  function getProgressColor(requirement: boolean) {
    return requirement ? 'text-green-400' : 'text-gray-400'
  }

  function getProgressBarColor(percentage: number) {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-blue-500'
    if (percentage >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  function getCategoryColor(category: number) {
    if (category <= 2) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    if (category <= 4) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (category <= 6) return 'bg-green-500/20 text-green-400 border-green-500/30'
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="text-center text-gray-400">
          <p className="text-xl mb-4">{error}</p>
          <p className="text-sm">Por favor, contacta al administrador del club.</p>
        </div>
      </MainLayout>
    )
  }

  if (!progress || !config) {
    return (
      <MainLayout>
        <div className="text-center text-gray-400">
          No hay datos de progreso disponibles
        </div>
      </MainLayout>
    )
  }

  const pointsPercentage = (progress.current_points / config.category_points_max) * 100
  const matchesPercentage = (progress.total_matches / config.min_total_matches) * 100
  const winRatePercentage = (progress.effectiveness_rate / config.min_win_rate) * 100

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">Progreso de Ascenso</h1>
          <p className="text-purple-100">Sistema de puntos por categoría con decaimiento temporal</p>
        </div>

        {/* Current Status */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full border ${getCategoryColor(progress.current_category)}`}>
                <span className="text-lg font-bold">{getCategoryName(progress.current_category)}</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">Categoría Actual</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{progress.current_points}</div>
              <p className="text-sm text-gray-400 mt-1">Puntos Actuales</p>
              <p className="text-xs text-gray-500">de {config.category_points_max} para ascender</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{progress.effectiveness_rate.toFixed(1)}%</div>
              <p className="text-sm text-gray-400 mt-1">Efectividad</p>
              <p className="text-xs text-gray-500">{progress.total_wins}/{progress.total_matches} victorias</p>
            </div>
          </div>
        </div>

        {/* Progress to Next Category */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            Ascenso a {getNextCategoryName(progress.current_category)}
          </h2>
          
          <div className="space-y-6">
            {/* Points Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">Puntos Acumulados</span>
                <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.points)}`}>
                  {progress.current_points} / {config.category_points_max}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(pointsPercentage)}`}
                  style={{ width: `${Math.min(pointsPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {progress.requirements_met.points ? '¡Requisito cumplido!' : `Te faltan ${progress.missing_requirements.points} puntos`}
              </p>
            </div>

            {/* Matches Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">Partidos Jugados</span>
                <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.min_total_matches)}`}>
                  {progress.total_matches} / {config.min_total_matches}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(matchesPercentage)}`}
                  style={{ width: `${Math.min(matchesPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {progress.requirements_met.min_total_matches ? '¡Requisito cumplido!' : `Te faltan ${progress.missing_requirements.min_total_matches} partidos`}
              </p>
            </div>

            {/* Win Rate Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">Win Rate Mínimo</span>
                <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.min_win_rate)}`}>
                  {progress.effectiveness_rate.toFixed(1)}% / {config.min_win_rate}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(winRatePercentage)}`}
                  style={{ width: `${Math.min(winRatePercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {progress.requirements_met.min_win_rate ? '¡Requisito cumplido!' : `Te faltan ${progress.missing_requirements.min_win_rate.toFixed(1)}% de efectividad`}
              </p>
            </div>
          </div>
        </div>

        {/* Point System Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Sistema de Puntos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-green-400">+{config.points_per_win}</div>
              <p className="text-xs text-gray-400 mt-1">Por victoria</p>
            </div>
            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">+{config.points_per_loss}</div>
              <p className="text-xs text-gray-400 mt-1">Por derrota</p>
            </div>
            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">+{config.bonus_superior_category}</div>
              <p className="text-xs text-gray-400 mt-1">Bonus vs superior</p>
            </div>
            <div className="text-center p-4 bg-gray-700/30 rounded-lg">
              <div className="text-2xl font-bold text-orange-400">{config.points_decay_months}</div>
              <p className="text-xs text-gray-400 mt-1">Meses de decaimiento</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Los puntos se mantienen por {config.points_decay_months} meses. Después de ese tiempo, los puntos más antiguos se eliminan mes a mes.
          </p>
        </div>

        {/* Requirements Summary */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Resumen de Requisitos</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
              <span className="text-sm text-gray-300">Puntos acumulados</span>
              <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.points)}`}>
                {progress.requirements_met.points ? 'Cumplido' : 'Pendiente'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
              <span className="text-sm text-gray-300">Victorias vs mismo nivel</span>
              <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.matches_won_same_level)}`}>
                {progress.requirements_met.matches_won_same_level ? 'Cumplido' : 'Pendiente'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
              <span className="text-sm text-gray-300">Partidos mínimos</span>
              <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.min_total_matches)}`}>
                {progress.requirements_met.min_total_matches ? 'Cumplido' : 'Pendiente'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
              <span className="text-sm text-gray-300">Win rate mínimo</span>
              <span className={`text-sm font-bold ${getProgressColor(progress.requirements_met.min_win_rate)}`}>
                {progress.requirements_met.min_win_rate ? 'Cumplido' : 'Pendiente'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
