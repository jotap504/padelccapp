'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface RankingConfig {
  id: string
  club_id: string
  base_points_winner: number
  base_points_loser: number
  level_diff_winner_multiplier: number
  level_diff_loser_penalty: number
  game_diff_bonus_winner_high: number
  game_diff_bonus_winner_medium: number
  game_diff_bonus_winner_low: number
  game_diff_bonus_loser_high: number
  game_diff_bonus_loser_medium: number
  game_diff_threshold_high: number
  game_diff_threshold_medium: number
  game_diff_threshold_low: number
  game_diff_close_threshold: number
  game_diff_medium_close_threshold: number
  minimum_points_per_match: number
  maximum_points_per_match: number
  enable_level_difference_bonus: boolean
  enable_game_difference_bonus: boolean
  comeback_bonus: number
  tiebreak_bonus: number
  retirement_penalty: number
  tournament_multiplier_default: number
  tournament_multiplier_championship: number
  tournament_multiplier_final: number
}

export default function RankingConfigPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [config, setConfig] = useState<RankingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'base' | 'level' | 'games' | 'special' | 'calculations'>('base')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      router.push('/dashboard')
      return
    }
    loadConfig()
  }, [isLoading, isAuthenticated, user, router])

  async function loadConfig() {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('ranking_configuration')
        .select('*')
        .eq('club_id', user.club_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading config:', error)
        alert('Error al cargar configuración')
      } else if (data) {
        setConfig(data)
      } else {
        await createDefaultConfig()
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createDefaultConfig() {
    if (!user) return

    const defaultConfig = {
      club_id: user.club_id,
      base_points_winner: 20,
      base_points_loser: 5,
      level_diff_winner_multiplier: 10.0,
      level_diff_loser_penalty: 1.0,
      game_diff_bonus_winner_high: 3,
      game_diff_bonus_winner_medium: 2,
      game_diff_bonus_winner_low: 1,
      game_diff_bonus_loser_high: 2,
      game_diff_bonus_loser_medium: 1,
      game_diff_threshold_high: 12,
      game_diff_threshold_medium: 8,
      game_diff_threshold_low: 4,
      game_diff_close_threshold: 4,
      game_diff_medium_close_threshold: 8,
      minimum_points_per_match: 1,
      maximum_points_per_match: 100,
      enable_level_difference_bonus: true,
      enable_game_difference_bonus: true,
      comeback_bonus: 5,
      tiebreak_bonus: 2,
      retirement_penalty: -10,
      tournament_multiplier_default: 1.0,
      tournament_multiplier_championship: 1.5,
      tournament_multiplier_final: 2.0
    }

    const { data, error } = await supabase
      .from('ranking_configuration')
      .insert(defaultConfig)
      .select()
      .single()

    if (error) {
      console.error('Error creating default config:', error)
    } else {
      setConfig(data)
    }
  }

  async function saveConfig() {
    if (!config) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('ranking_configuration')
        .update({
          ...config,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)

      if (error) {
        alert('Error al guardar configuración: ' + error.message)
      } else {
        alert('Configuración guardada exitosamente')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  function updateConfigField(field: keyof RankingConfig, value: any) {
    if (!config) return
    setConfig({ ...config, [field]: value })
  }

  function calculateExamplePoints() {
    if (!config) return null

    const teamAvg = 4.5
    const opponentAvg = 5.0
    const levelDiff = Math.abs(teamAvg - opponentAvg)
    const gameDiff = 2

    let winnerPoints = config.base_points_winner
    let loserPoints = config.base_points_loser

    if (config.enable_level_difference_bonus && teamAvg < opponentAvg) {
      winnerPoints += levelDiff * config.level_diff_winner_multiplier
      loserPoints -= levelDiff * config.level_diff_loser_penalty
    }

    if (config.enable_game_difference_bonus) {
      if (gameDiff >= config.game_diff_threshold_low) {
        winnerPoints += config.game_diff_bonus_winner_low
      }
      if (Math.abs(gameDiff) <= config.game_diff_close_threshold) {
        loserPoints += config.game_diff_bonus_loser_high
      }
    }

    return {
      winner: Math.max(config.minimum_points_per_match, Math.round(winnerPoints)),
      loser: Math.max(config.minimum_points_per_match, Math.round(loserPoints))
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

  if (!config) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">No se pudo cargar la configuración.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const example = calculateExamplePoints()

  const tabs = [
    { id: 'base', label: 'Puntos Base', icon: '🎯' },
    { id: 'level', label: 'Diferencia Nivel', icon: '📊' },
    { id: 'games', label: 'Diferencia Games', icon: '🎾' },
    { id: 'special', label: 'Bonos/Penalizaciones', icon: '⭐' },
    { id: 'calculations', label: 'Cálculos', icon: '🧮' },
  ]

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white mb-2">⚙️ Configuración de Ranking</h1>
            <p className="text-blue-100">Personaliza el sistema de puntuación del club</p>
          </div>
        </div>

        {/* Example Preview */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white mb-1">Ejemplo Actual</h3>
              <p className="text-sm text-gray-400">
                4ta+5ta vs 4ta+6ta (ganador 6-4/4-6/6-4)
              </p>
            </div>
            {example && (
              <div className="text-right">
                <div className="flex gap-4">
                  <div className="bg-green-500/20 px-4 py-2 rounded-lg">
                    <span className="text-sm text-green-400">Ganador: </span>
                    <span className="text-lg font-bold text-green-400">+{example.winner}</span>
                  </div>
                  <div className="bg-red-500/20 px-4 py-2 rounded-lg">
                    <span className="text-sm text-red-400">Perdedor: </span>
                    <span className="text-lg font-bold text-red-400">{example.loser > 0 ? '+' : ''}{example.loser}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          {/* Base Points Tab */}
          {activeTab === 'base' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Puntos Base</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puntos Base Ganador
                  </label>
                  <input
                    type="number"
                    value={config.base_points_winner}
                    onChange={(e) => updateConfigField('base_points_winner', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Puntos que recibe el ganador por defecto
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puntos Base Perdedor
                  </label>
                  <input
                    type="number"
                    value={config.base_points_loser}
                    onChange={(e) => updateConfigField('base_points_loser', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Puntos que recibe el perdedor por defecto
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puntos Mínimos por Partido
                  </label>
                  <input
                    type="number"
                    value={config.minimum_points_per_match}
                    onChange={(e) => updateConfigField('minimum_points_per_match', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puntos Máximos por Partido
                  </label>
                  <input
                    type="number"
                    value={config.maximum_points_per_match}
                    onChange={(e) => updateConfigField('maximum_points_per_match', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Level Difference Tab */}
          {activeTab === 'level' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Diferencia de Nivel</h2>
              
              <div className="flex items-center gap-3 mb-6">
                <input
                  type="checkbox"
                  checked={config.enable_level_difference_bonus}
                  onChange={(e) => updateConfigField('enable_level_difference_bonus', e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500"
                />
                <label className="text-gray-300">Activar bonus por diferencia de nivel</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Multiplicador Ganador (por categoría de diferencia)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.level_diff_winner_multiplier}
                    onChange={(e) => updateConfigField('level_diff_winner_multiplier', parseFloat(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cuando gana el equipo de menor categoría
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Penalización Perdedor (por categoría de diferencia)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.level_diff_loser_penalty}
                    onChange={(e) => updateConfigField('level_diff_loser_penalty', parseFloat(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cuando pierde el equipo de mayor categoría
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Games Difference Tab */}
          {activeTab === 'games' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Diferencia de Games</h2>
              
              <div className="flex items-center gap-3 mb-6">
                <input
                  type="checkbox"
                  checked={config.enable_game_difference_bonus}
                  onChange={(e) => updateConfigField('enable_game_difference_bonus', e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500"
                />
                <label className="text-gray-300">Activar bonus por diferencia de games</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-white mb-3">Bonus para Ganador</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Diferencia Alta (≥{config.game_diff_threshold_high} games)</label>
                      <input
                        type="number"
                        value={config.game_diff_bonus_winner_high}
                        onChange={(e) => updateConfigField('game_diff_bonus_winner_high', parseInt(e.target.value))}
                        className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Diferencia Media (≥{config.game_diff_threshold_medium} games)</label>
                      <input
                        type="number"
                        value={config.game_diff_bonus_winner_medium}
                        onChange={(e) => updateConfigField('game_diff_bonus_winner_medium', parseInt(e.target.value))}
                        className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Diferencia Baja (≥{config.game_diff_threshold_low} games)</label>
                      <input
                        type="number"
                        value={config.game_diff_bonus_winner_low}
                        onChange={(e) => updateConfigField('game_diff_bonus_winner_low', parseInt(e.target.value))}
                        className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-white mb-3">Bonus para Perdedor (partido reñido)</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Partido Muy Reñido (≤{config.game_diff_close_threshold} games)</label>
                      <input
                        type="number"
                        value={config.game_diff_bonus_loser_high}
                        onChange={(e) => updateConfigField('game_diff_bonus_loser_high', parseInt(e.target.value))}
                        className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Partido Reñido (≤{config.game_diff_medium_close_threshold} games)</label>
                      <input
                        type="number"
                        value={config.game_diff_bonus_loser_medium}
                        onChange={(e) => updateConfigField('game_diff_bonus_loser_medium', parseInt(e.target.value))}
                        className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="font-medium text-white mb-3">Umbrales de Diferencia</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Alto</label>
                    <input
                      type="number"
                      value={config.game_diff_threshold_high}
                      onChange={(e) => updateConfigField('game_diff_threshold_high', parseInt(e.target.value))}
                      className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Medio</label>
                    <input
                      type="number"
                      value={config.game_diff_threshold_medium}
                      onChange={(e) => updateConfigField('game_diff_threshold_medium', parseInt(e.target.value))}
                      className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bajo</label>
                    <input
                      type="number"
                      value={config.game_diff_threshold_low}
                      onChange={(e) => updateConfigField('game_diff_threshold_low', parseInt(e.target.value))}
                      className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Special Bonuses Tab */}
          {activeTab === 'special' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Bonos y Penalizaciones Especiales</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bonus por Remontada
                  </label>
                  <input
                    type="number"
                    value={config.comeback_bonus}
                    onChange={(e) => updateConfigField('comeback_bonus', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cuando un equipo pierde el primer set pero gana el partido
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bonus por Tiebreak
                  </label>
                  <input
                    type="number"
                    value={config.tiebreak_bonus}
                    onChange={(e) => updateConfigField('tiebreak_bonus', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Por cada set decidido en tiebreak
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Penalización por Abandono
                  </label>
                  <input
                    type="number"
                    value={config.retirement_penalty}
                    onChange={(e) => updateConfigField('retirement_penalty', parseInt(e.target.value))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Puntos negativos por abandono del partido
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-6">
                <h3 className="font-medium text-white mb-4">Multiplicadores de Torneo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Default</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.tournament_multiplier_default}
                      onChange={(e) => updateConfigField('tournament_multiplier_default', parseFloat(e.target.value))}
                      className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Campeonato</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.tournament_multiplier_championship}
                      onChange={(e) => updateConfigField('tournament_multiplier_championship', parseFloat(e.target.value))}
                      className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Final</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.tournament_multiplier_final}
                      onChange={(e) => updateConfigField('tournament_multiplier_final', parseFloat(e.target.value))}
                      className="w-full rounded-lg bg-gray-700 border-gray-600 text-white px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calculations Tab */}
          {activeTab === 'calculations' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Vista Previa de Cálculos</h2>
              
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                <h3 className="font-medium text-white mb-4">Escenarios de Ejemplo</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-white font-medium">4ta+5ta vs 4ta+6ta</p>
                      <p className="text-sm text-gray-400">Ganador: 6-4, 4-6, 6-4</p>
                    </div>
                    {example && (
                      <div className="text-right">
                        <p className="text-green-400">+{example.winner} pts ganador</p>
                        <p className="text-red-400">{example.loser > 0 ? '+' : ''}{example.loser} pts perdedor</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg">
                    <p className="text-gray-400 text-sm mb-2">Fórmula aplicada:</p>
                    <code className="text-xs text-blue-300 block bg-gray-900 p-3 rounded">
                      Puntos = Base + BonusNivel + BonusGames<br/>
                      (con límites mínimo y máximo aplicados)
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar Configuración'}
          </button>
        </div>
      </div>
    </MainLayout>
  )
}
