'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface PromotionRequirement {
  id: string
  from_category: number
  matches_won_same_level: number
  matches_won_higher_level: number
  min_total_matches: number
  min_win_rate: number
  min_rating_promotion: number
  rating_buffer: number
  min_days_in_category: number
  max_promotions_per_season: number
  require_consistency: boolean
}

interface CategoryStatus {
  category: number
  name: string
  rating_min: number
  rating_max: number
  requirement?: PromotionRequirement
}

export default function CategoryPromotionConfig() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [requirements, setRequirements] = useState<PromotionRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [clubId, setClubId] = useState<string>('')
  
  const categories: CategoryStatus[] = [
    { category: 8, name: '8va', rating_min: 0, rating_max: 599 },
    { category: 7, name: '7ma', rating_min: 600, rating_max: 749 },
    { category: 6, name: '6ta', rating_min: 750, rating_max: 874 },
    { category: 5, name: '5ta', rating_min: 875, rating_max: 999 },
    { category: 4, name: '4ta', rating_min: 1000, rating_max: 1149 },
    { category: 3, name: '3ra', rating_min: 1150, rating_max: 1299 },
    { category: 2, name: '2da', rating_min: 1300, rating_max: 1499 },
    { category: 1, name: '1ra', rating_min: 1500, rating_max: 9999 }
  ]

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/login')
      return
    }
    
    const clubIdParam = searchParams.get('club_id')
    if (clubIdParam) {
      setClubId(clubIdParam)
      loadRequirements(clubIdParam)
    }
  }, [isLoading, isAuthenticated, user, router, searchParams])

  async function loadRequirements(clubId: string) {
    try {
      const { data, error } = await supabase
        .from('category_promotion_requirements')
        .select('*')
        .eq('club_id', clubId)
        .order('from_category', { ascending: false })

      if (error) {
        console.error('Error loading requirements:', error)
        setMessage('Error al cargar configuración')
      } else {
        setRequirements(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }

  async function saveRequirement(category: number, updates: Partial<PromotionRequirement>) {
    setSaving(true)
    setMessage('')

    try {
      const existing = requirements.find(r => r.from_category === category)
      
      if (existing) {
        const { error } = await supabase
          .from('category_promotion_requirements')
          .update(updates)
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('category_promotion_requirements')
          .insert({
            club_id: clubId,
            from_category: category,
            ...updates
          })

        if (error) throw error
      }

      setMessage('Configuración guardada exitosamente')
      loadRequirements(clubId)
    } catch (error) {
      console.error('Error saving requirement:', error)
      setMessage('Error al guardar configuración')
    } finally {
      setSaving(false)
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
              setClubId(e.target.value)
              if (e.target.value) {
                loadRequirements(e.target.value)
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
            const requirement = requirements.find(r => r.from_category === category.category)
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
                      value={requirement?.matches_won_same_level || 30}
                      onChange={(e) => {
                        const newRequirements = [...requirements]
                        const index = newRequirements.findIndex(r => r.from_category === category.category)
                        if (index >= 0) {
                          newRequirements[index] = { ...newRequirements[index], matches_won_same_level: parseInt(e.target.value) }
                        } else {
                          newRequirements.push({ 
                            id: '', 
                            from_category: category.category, 
                            matches_won_same_level: parseInt(e.target.value),
                            matches_won_higher_level: 10,
                            min_total_matches: 40,
                            min_win_rate: 65,
                            min_rating_promotion: 0,
                            rating_buffer: 150,
                            min_days_in_category: 60,
                            max_promotions_per_season: 2,
                            require_consistency: true
                          } as PromotionRequirement)
                        }
                        setRequirements(newRequirements)
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
                      value={requirement?.matches_won_higher_level || 10}
                      onChange={(e) => {
                        const newRequirements = [...requirements]
                        const index = newRequirements.findIndex(r => r.from_category === category.category)
                        if (index >= 0) {
                          newRequirements[index] = { ...newRequirements[index], matches_won_higher_level: parseInt(e.target.value) }
                        } else {
                          newRequirements.push({ 
                            id: '', 
                            from_category: category.category, 
                            matches_won_same_level: 30,
                            matches_won_higher_level: parseInt(e.target.value),
                            min_total_matches: 40,
                            min_win_rate: 65,
                            min_rating_promotion: 0,
                            rating_buffer: 150,
                            min_days_in_category: 60,
                            max_promotions_per_season: 2,
                            require_consistency: true
                          } as PromotionRequirement)
                        }
                        setRequirements(newRequirements)
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
                      value={requirement?.min_total_matches || 40}
                      onChange={(e) => {
                        const newRequirements = [...requirements]
                        const index = newRequirements.findIndex(r => r.from_category === category.category)
                        if (index >= 0) {
                          newRequirements[index] = { ...newRequirements[index], min_total_matches: parseInt(e.target.value) }
                        } else {
                          newRequirements.push({ 
                            id: '', 
                            from_category: category.category, 
                            matches_won_same_level: 30,
                            matches_won_higher_level: 10,
                            min_total_matches: parseInt(e.target.value),
                            min_win_rate: 65,
                            min_rating_promotion: 0,
                            rating_buffer: 150,
                            min_days_in_category: 60,
                            max_promotions_per_season: 2,
                            require_consistency: true
                          } as PromotionRequirement)
                        }
                        setRequirements(newRequirements)
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
                      value={requirement?.min_win_rate || 65}
                      onChange={(e) => {
                        const newRequirements = [...requirements]
                        const index = newRequirements.findIndex(r => r.from_category === category.category)
                        if (index >= 0) {
                          newRequirements[index] = { ...newRequirements[index], min_win_rate: parseFloat(e.target.value) }
                        } else {
                          newRequirements.push({ 
                            id: '', 
                            from_category: category.category, 
                            matches_won_same_level: 30,
                            matches_won_higher_level: 10,
                            min_total_matches: 40,
                            min_win_rate: parseFloat(e.target.value),
                            min_rating_promotion: 0,
                            rating_buffer: 150,
                            min_days_in_category: 60,
                            max_promotions_per_season: 2,
                            require_consistency: true
                          } as PromotionRequirement)
                        }
                        setRequirements(newRequirements)
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
                      value={requirement?.min_rating_promotion || nextCategory?.rating_min || 0}
                      onChange={(e) => {
                        const newRequirements = [...requirements]
                        const index = newRequirements.findIndex(r => r.from_category === category.category)
                        if (index >= 0) {
                          newRequirements[index] = { ...newRequirements[index], min_rating_promotion: parseInt(e.target.value) }
                        } else {
                          newRequirements.push({ 
                            id: '', 
                            from_category: category.category, 
                            matches_won_same_level: 30,
                            matches_won_higher_level: 10,
                            min_total_matches: 40,
                            min_win_rate: 65,
                            min_rating_promotion: parseInt(e.target.value),
                            rating_buffer: 150,
                            min_days_in_category: 60,
                            max_promotions_per_season: 2,
                            require_consistency: true
                          } as PromotionRequirement)
                        }
                        setRequirements(newRequirements)
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
                      value={requirement?.rating_buffer || 150}
                      onChange={(e) => {
                        const newRequirements = [...requirements]
                        const index = newRequirements.findIndex(r => r.from_category === category.category)
                        if (index >= 0) {
                          newRequirements[index] = { ...newRequirements[index], rating_buffer: parseInt(e.target.value) }
                        } else {
                          newRequirements.push({ 
                            id: '', 
                            from_category: category.category, 
                            matches_won_same_level: 30,
                            matches_won_higher_level: 10,
                            min_total_matches: 40,
                            min_win_rate: 65,
                            min_rating_promotion: 0,
                            rating_buffer: parseInt(e.target.value),
                            min_days_in_category: 60,
                            max_promotions_per_season: 2,
                            require_consistency: true
                          } as PromotionRequirement)
                        }
                        setRequirements(newRequirements)
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Puntos adicionales sobre el mínimo de categoría</p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => {
                      const req = requirements.find(r => r.from_category === category.category)
                      if (req) {
                        saveRequirement(category.category, req)
                      } else {
                        saveRequirement(category.category, {
                          matches_won_same_level: 30,
                          matches_won_higher_level: 10,
                          min_total_matches: 40,
                          min_win_rate: 65,
                          min_rating_promotion: nextCategory?.rating_min || 0,
                          rating_buffer: 150,
                          min_days_in_category: 60,
                          max_promotions_per_season: 2,
                          require_consistency: true
                        })
                      }
                    }}
                    disabled={saving}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
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
