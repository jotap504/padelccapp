'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/AuthContext'

interface PointConfig {
  base_rating: number
  points_per_win: number
  points_per_loss: number
  points_per_game_diff: number
  category_bonus_percent: number
  category_penalty_percent: number
  max_points_per_match: number
  min_rating: number
}

export default function PointConfigPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<PointConfig>({
    base_rating: 1500,
    points_per_win: 20,
    points_per_loss: 20,
    points_per_game_diff: 0.5,
    category_bonus_percent: 20,
    category_penalty_percent: 5,
    max_points_per_match: 50,
    min_rating: 1000
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (user?.club_id) {
      loadConfig()
    }
  }, [user?.club_id])

  async function loadConfig() {
    if (!user?.club_id) return
    
    const { data, error } = await supabase
      .from('club_point_configs')
      .select('*')
      .eq('club_id', user.club_id)
      .single()
    
    if (data) {
      setConfig(data)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!user?.club_id) return
    
    setSaving(true)
    setMessage('')
    
    const { error } = await supabase
      .from('club_point_configs')
      .upsert({
        club_id: user.club_id,
        ...config
      })
    
    if (error) {
      setMessage('Error al guardar: ' + error.message)
    } else {
      setMessage('Configuración guardada correctamente')
    }
    
    setSaving(false)
  }

  async function handleRecalculate() {
    setMessage('Recalculando ranking...')
    
    try {
      const response = await fetch('/api/recalculate-ranking', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        setMessage('Ranking recalculado exitosamente')
      } else {
        setMessage('Error: ' + result.error)
      }
    } catch (error: any) {
      setMessage('Error al recalcular: ' + error.message)
    }
  }

  if (loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Configuración de Puntos</h1>
      
      {message && (
        <div className={`p-4 rounded mb-6 ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Valores Base</h2>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating Inicial
            </label>
            <input
              type="number"
              value={config.base_rating}
              onChange={(e) => setConfig({...config, base_rating: parseInt(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Rating con el que empiezan todos los jugadores</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating Mínimo
            </label>
            <input
              type="number"
              value={config.min_rating}
              onChange={(e) => setConfig({...config, min_rating: parseInt(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Rating mínimo posible</p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Puntos por Victoria
            </label>
            <input
              type="number"
              value={config.points_per_win}
              onChange={(e) => setConfig({...config, points_per_win: parseInt(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Puntos por Derrota
            </label>
            <input
              type="number"
              value={config.points_per_loss}
              onChange={(e) => setConfig({...config, points_per_loss: parseInt(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Puntos que se restan</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Puntos por Diferencia de Games
            </label>
            <input
              type="number"
              step="0.1"
              value={config.points_per_game_diff}
              onChange={(e) => setConfig({...config, points_per_game_diff: parseFloat(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Por cada game de diferencia</p>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Máximo Puntos por Partido
          </label>
          <input
            type="number"
            value={config.max_points_per_match}
            onChange={(e) => setConfig({...config, max_points_per_match: parseInt(e.target.value)})}
            className="w-32 border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Límite de puntos que se pueden ganar o perder en un partido</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Bonus y Penalizaciones por Categoría</h2>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bonus por Categoría Superior (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={config.category_bonus_percent}
              onChange={(e) => setConfig({...config, category_bonus_percent: parseFloat(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Por cada categoría de diferencia al ganarle a un rival superior.<br/>
              Ej: Si un 6to le gana a un 4to (2 categorías) = +{config.category_bonus_percent * 2}% extra
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Penalización por Categoría Inferior (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={config.category_penalty_percent}
              onChange={(e) => setConfig({...config, category_penalty_percent: parseFloat(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Por cada categoría de diferencia al perder con un rival inferior.<br/>
              Ej: Si un 4to pierde con un 6to (2 categorías) = -{config.category_penalty_percent * 2}% adicional
            </p>
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-medium text-blue-900 mb-2">Ejemplo de Cálculo:</h3>
          <p className="text-sm text-blue-800">
            Un jugador de <strong>6ta categoría</strong> le gana a uno de <strong>4ta categoría</strong> por <strong>6-4, 6-3</strong>:
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1">
            <li>• Base por victoria: +{config.points_per_win} puntos</li>
            <li>• Diferencia de games: (12-7) = 5 games × {config.points_per_game_diff} = +{(5 * config.points_per_game_diff).toFixed(1)} puntos</li>
            <li>• Bonus por categoría (2 categorías de diferencia): +{config.category_bonus_percent * 2}% = +{((config.points_per_win + 5 * config.points_per_game_diff) * config.category_bonus_percent * 2 / 100).toFixed(1)} puntos</li>
            <li className="font-medium">• Total: ~+{Math.round(config.points_per_win + 5 * config.points_per_game_diff + (config.points_per_win + 5 * config.points_per_game_diff) * config.category_bonus_percent * 2 / 100)} puntos</li>
          </ul>
        </div>
      </div>
      
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
        
        <button
          onClick={handleRecalculate}
          className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700"
        >
          Recalcular Ranking Ahora
        </button>
      </div>
    </div>
  )
}
