'use client'

import { useState, useEffect } from 'react'
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
  8: { from_category: 8, matches_won_same_level: 25, matches_won_higher_level: 8, min_total_matches: 35, min_win_rate: 60, min_rating_promotion: 600, rating_buffer: 100 },
  7: { from_category: 7, matches_won_same_level: 25, matches_won_higher_level: 8, min_total_matches: 35, min_win_rate: 62, min_rating_promotion: 700, rating_buffer: 100 },
  6: { from_category: 6, matches_won_same_level: 28, matches_won_higher_level: 10, min_total_matches: 40, min_win_rate: 65, min_rating_promotion: 800, rating_buffer: 125 },
  5: { from_category: 5, matches_won_same_level: 28, matches_won_higher_level: 10, min_total_matches: 40, min_win_rate: 65, min_rating_promotion: 900, rating_buffer: 125 },
  4: { from_category: 4, matches_won_same_level: 30, matches_won_higher_level: 12, min_total_matches: 45, min_win_rate: 68, min_rating_promotion: 1050, rating_buffer: 150 },
  3: { from_category: 3, matches_won_same_level: 30, matches_won_higher_level: 12, min_total_matches: 45, min_win_rate: 70, min_rating_promotion: 1200, rating_buffer: 150 },
  2: { from_category: 2, matches_won_same_level: 35, matches_won_higher_level: 15, min_total_matches: 50, min_win_rate: 75, min_rating_promotion: 1350, rating_buffer: 200 }
}

export default function CategoryPromotionPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [clubId, setClubId] = useState('')
  const [configs, setConfigs] = useState<CategoryConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/login')
      return
    }
    
    // Obtener club_id de la URL
    const urlParams = new URLSearchParams(window.location.search)
    const clubIdFromUrl = urlParams.get('club_id')
    if (clubIdFromUrl) {
      setClubId(clubIdFromUrl)
      loadConfigs(clubIdFromUrl)
    }
  }, [isLoading, isAuthenticated, user, router])

  async function loadConfigs(clubId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('category_promotion_requirements')
        .select('*')
        .eq('club_id', clubId)
        .order('from_category', { ascending: false })

      if (error) {
        console.error('Error loading configs:', error)
        setMessage('Error al cargar configuración')
      } else {
        setConfigs(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Error al cargar configuración')
    } finally {
      setLoading(false)
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
          <h1 className="text-3xl font-bold text-white mb-2">⚙️ Configuración de Ascensos</h1>
          <p className="text-purple-100">Ajusta los requisitos para cambiar de categoría</p>
        </div>

        {/* Club Selection */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Seleccionar Club</label>
          <input
            type="text"
            value={clubId}
            onChange={(e) => {
              const newClubId = e.target.value
              setClubId(newClubId)
              if (newClubId) {
                loadConfigs(newClubId)
              }
            }}
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
                    Ascenso: {category.name} → {nextCategory?.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                      Rating: {category.rating_min}-{category.rating_max}
                    </span>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                      Hacia: {nextCategory?.rating_min}+
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Victorias mismo nivel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Victorias vs mismo nivel
                    </label>
                    <input
                      type="number"
                      value={config.matches_won_same_level}
                      onChange={(e) => {
                        const newConfig = { ...config, matches_won_same_level: parseInt(e.target.value) }
                        const newConfigs = configs.filter(c => c.from_category !== category.category)
                        setConfigs([...newConfigs, newConfig])
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo de victorias contra igual categoría</p>
                  </div>

                  {/* Victorias nivel superior */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Victorias vs nivel superior
                    </label>
                    <input
                      type="number"
                      value={config.matches_won_higher_level}
                      onChange={(e) => {
                        const newConfig = { ...config, matches_won_higher_level: parseInt(e.target.value) }
                        const newConfigs = configs.filter(c => c.from_category !== category.category)
                        setConfigs([...newConfigs, newConfig])
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Victoria contra categorías superiores acelera ascenso</p>
                  </div>

                  {/* Mínimo de partidos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Total de partidos mínimos
                    </label>
                    <input
                      type="number"
                      value={config.min_total_matches}
                      onChange={(e) => {
                        const newConfig = { ...config, min_total_matches: parseInt(e.target.value) }
                        const newConfigs = configs.filter(c => c.from_category !== category.category)
                        setConfigs([...newConfigs, newConfig])
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Partidos totales en la categoría actual</p>
                  </div>

                  {/* Porcentaje de victorias */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      % Victorias mínimo
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.min_win_rate}
                      onChange={(e) => {
                        const newConfig = { ...config, min_win_rate: parseFloat(e.target.value) }
                        const newConfigs = configs.filter(c => c.from_category !== category.category)
                        setConfigs([...newConfigs, newConfig])
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Porcentaje mínimo de victorias</p>
                  </div>

                  {/* Rating mínimo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rating mínimo para ascender
                    </label>
                    <input
                      type="number"
                      value={config.min_rating_promotion || nextCategory?.rating_min || 0}
                      onChange={(e) => {
                        const newConfig = { ...config, min_rating_promotion: parseInt(e.target.value) }
                        const newConfigs = configs.filter(c => c.from_category !== category.category)
                        setConfigs([...newConfigs, newConfig])
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Rating ELO mínimo para ascender</p>
                  </div>

                  {/* Buffer de puntos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Buffer de puntos
                    </label>
                    <input
                      type="number"
                      value={config.rating_buffer || 150}
                      onChange={(e) => {
                        const newConfig = { ...config, rating_buffer: parseInt(e.target.value) }
                        const newConfigs = configs.filter(c => c.from_category !== category.category)
                        setConfigs([...newConfigs, newConfig])
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Puntos adicionales sobre el mínimo de categoría</p>
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
