'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface CategoryConfig {
  id?: string
  from_category: number
  matches_won_same_level: number
  matches_won_higher_level: number
  min_total_matches: number
  min_win_rate: number
  min_rating_promotion: number
  rating_buffer: number
  category_points_max: number
  points_per_win: number
  points_per_loss: number
  bonus_superior_category: number
  points_decay_months: number
}

const categories = [
  { category: 8, name: '8va', rating_min: 0, rating_max: 599 },
  { category: 7, name: '7ma', rating_min: 600, rating_max: 749 },
  { category: 6, name: '6ta', rating_min: 750, rating_max: 874 },
  { category: 5, name: '5ta', rating_min: 875, rating_max: 999 },
  { category: 4, name: '4ta', rating_min: 1000, rating_max: 1149 },
  { category: 3, name: '3ra', rating_min: 1150, rating_max: 1299 },
  { category: 2, name: '2da', rating_min: 1300, rating_max: 1499 },
  { category: 1, name: '1ra', rating_min: 1500, rating_max: 9999 }
]

const defaultConfigs: { [key: number]: CategoryConfig } = {
  8: { 
    from_category: 8, 
    matches_won_same_level: 15, 
    matches_won_higher_level: 5, 
    min_total_matches: 20, 
    min_win_rate: 55, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  },
  7: { 
    from_category: 7, 
    matches_won_same_level: 18, 
    matches_won_higher_level: 6, 
    min_total_matches: 25, 
    min_win_rate: 58, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  },
  6: { 
    from_category: 6, 
    matches_won_same_level: 20, 
    matches_won_higher_level: 8, 
    min_total_matches: 30, 
    min_win_rate: 60, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  },
  5: { 
    from_category: 5, 
    matches_won_same_level: 22, 
    matches_won_higher_level: 10, 
    min_total_matches: 35, 
    min_win_rate: 62, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  },
  4: { 
    from_category: 4, 
    matches_won_same_level: 25, 
    matches_won_higher_level: 12, 
    min_total_matches: 40, 
    min_win_rate: 65, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  },
  3: { 
    from_category: 3, 
    matches_won_same_level: 28, 
    matches_won_higher_level: 15, 
    min_total_matches: 45, 
    min_win_rate: 68, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  },
  2: { 
    from_category: 2, 
    matches_won_same_level: 30, 
    matches_won_higher_level: 18, 
    min_total_matches: 50, 
    min_win_rate: 70, 
    min_rating_promotion: 0, 
    rating_buffer: 0,
    category_points_max: 500,
    points_per_win: 20,
    points_per_loss: 5,
    bonus_superior_category: 10,
    points_decay_months: 12
  }
}

export default function CategoryPromotionPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [clubId, setClubId] = useState('')
  const [configs, setConfigs] = useState<CategoryConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (!mounted || isLoading) return
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/login')
      return
    }
    
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const clubIdFromUrl = urlParams.get('club_id')
      if (clubIdFromUrl) {
        setClubId(clubIdFromUrl)
        loadConfigs(clubIdFromUrl)
      }
    }
  }, [mounted, isLoading, isAuthenticated, user, router])

  async function loadConfigs(clubId: string) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('category_promotion_requirements')
        .select('*')
        .eq('club_id', clubId)
        .order('from_category', { ascending: false })

      if (abortController.signal.aborted) return

      if (error) {
        console.error('Error loading configs:', error)
        setMessage('Error al cargar configuración')
      } else {
        setConfigs(data || [])
      }
    } catch (error) {
      if (abortController.signal.aborted) return
      console.error('Error:', error)
      setMessage('Error al cargar configuración')
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
      }
    }
  }

  async function saveConfig(category: number, config: CategoryConfig) {
    if (!clubId) {
      setMessage('Por favor selecciona un club primero')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const existing = configs.find(c => c.from_category === category)
      
      if (existing && existing.id) {
        const { error } = await supabase
          .from('category_promotion_requirements')
          .update(config)
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('category_promotion_requirements')
          .insert({
            club_id: clubId,
            ...config
          })

        if (error) throw error
      }

      setMessage('Configuración guardada exitosamente')
      loadConfigs(clubId)
    } catch (error) {
      console.error('Error saving config:', error)
      setMessage('Error al guardar configuración')
    } finally {
      setLoading(false)
    }
  }

  function handleClubIdChange(newClubId: string) {
    setClubId(newClubId)
    if (newClubId) {
      loadConfigs(newClubId)
    }
  }

  function handleConfigChange(category: number, field: keyof CategoryConfig, value: number) {
    const newConfigs = configs.filter(c => c.from_category !== category)
    const existingConfig = configs.find(c => c.from_category === category) || defaultConfigs[category]
    const updatedConfig = { ...existingConfig, [field]: value }
    setConfigs([...newConfigs, updatedConfig])
  }

  if (!mounted) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">Configuración de Ascensos</h1>
          <p className="text-purple-100">Sistema de puntos por categoría con decaimiento temporal</p>
        </div>

        {/* Club Selection */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Seleccionar Club</label>
          <input
            type="text"
            value={clubId}
            onChange={(e) => handleClubIdChange(e.target.value)}
            placeholder="ID del Club"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.includes('exitosamente') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message}
          </div>
        )}

        {/* Configuration Cards */}
        <div className="space-y-6">
          {categories.filter(cat => cat.category > 1).map((category) => {
            const config = configs.find(c => c.from_category === category.category) || defaultConfigs[category.category]
            const nextCategory = categories.find(c => c.category === category.category - 1)
            
            return (
              <div key={category.category} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">
                    Ascenso: {category.name} &rarr; {nextCategory?.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                      {category.name}
                    </span>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                      Puntos: 0-{config.category_points_max}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Puntos por Victoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Puntos por Victoria
                    </label>
                    <input
                      type="number"
                      value={config.points_per_win}
                      onChange={(e) => handleConfigChange(category.category, 'points_per_win', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Puntos otorgados por cada victoria</p>
                  </div>

                  {/* Puntos por Derrota */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Puntos por Derrota
                    </label>
                    <input
                      type="number"
                      value={config.points_per_loss}
                      onChange={(e) => handleConfigChange(category.category, 'points_per_loss', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Puntos otorgados solo por participar</p>
                  </div>

                  {/* Bonus vs Categoría Superior */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bonus vs Categoría Superior
                    </label>
                    <input
                      type="number"
                      value={config.bonus_superior_category}
                      onChange={(e) => handleConfigChange(category.category, 'bonus_superior_category', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Puntos extra por ganar vs categorías superiores</p>
                  </div>

                  {/* Máximo de Puntos para Ascenso */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Máximo de Puntos para Ascenso
                    </label>
                    <input
                      type="number"
                      value={config.category_points_max}
                      onChange={(e) => handleConfigChange(category.category, 'category_points_max', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Puntos necesarios para ascender de categoría</p>
                  </div>

                  {/* Decaimiento por Tiempo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Decaimiento (meses)
                    </label>
                    <input
                      type="number"
                      value={config.points_decay_months}
                      onChange={(e) => handleConfigChange(category.category, 'points_decay_months', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Meses que se mantienen los puntos (defecto: 12)</p>
                  </div>

                  {/* Victorias Mismo Nivel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Victorias vs Mismo Nivel
                    </label>
                    <input
                      type="number"
                      value={config.matches_won_same_level}
                      onChange={(e) => handleConfigChange(category.category, 'matches_won_same_level', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Victorias mínimas vs jugadores de misma categoría</p>
                  </div>

                  {/* Victorias Nivel Superior */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Victorias vs Nivel Superior
                    </label>
                    <input
                      type="number"
                      value={config.matches_won_higher_level}
                      onChange={(e) => handleConfigChange(category.category, 'matches_won_higher_level', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Victorias mínimas vs categorías superiores</p>
                  </div>

                  {/* Partidos Mínimos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Partidos Mínimos
                    </label>
                    <input
                      type="number"
                      value={config.min_total_matches}
                      onChange={(e) => handleConfigChange(category.category, 'min_total_matches', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Partidos totales mínimos en la categoría</p>
                  </div>

                  {/* Win Rate Mínimo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Win Rate Mínimo (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.min_win_rate}
                      onChange={(e) => handleConfigChange(category.category, 'min_win_rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Porcentaje mínimo de victorias</p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => saveConfig(category.category, config)}
                    disabled={loading || !clubId}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </MainLayout>
  )
}
