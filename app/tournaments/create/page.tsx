'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'

const TOURNAMENT_TYPES = [
  { value: 'single_elimination', label: 'Eliminación Simple' },
  { value: 'double_elimination', label: 'Eliminación Doble' },
  { value: 'round_robin', label: 'Todos contra Todos' },
  { value: 'swiss', label: 'Sistema Suizo' }
]

const CATEGORIES = [
  { value: 1, label: '1ra' },
  { value: 2, label: '2da' },
  { value: 3, label: '3ra' },
  { value: 4, label: '4ta' },
  { value: 5, label: '5ta' },
  { value: 6, label: '6ta' },
  { value: 7, label: '7ma' },
  { value: 8, label: '8va' }
]

export default function CreateTournamentPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'single_elimination',
    category: 4,
    max_participants: 16,
    registration_start_date: '',
    registration_end_date: '',
    start_date: '',
    end_date: '',
    registration_fee: 0,
    rules: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    
    setSaving(true)
    
    const { error } = await supabase.from('tournaments').insert({
      ...formData,
      club_id: user.club_id,
      created_by: user.id,
      status: 'registration_open'
    })
    
    if (!error) {
      router.push('/tournaments')
    } else {
      alert('Error al crear torneo: ' + error.message)
    }
    
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/tournaments')} className="text-gray-500 hover:text-gray-700">
                ← Volver
              </button>
              <h1 className="text-xl font-bold text-gray-900">Crear Torneo</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Torneo</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="Ej: Torneo de Apertura 2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="Describe el torneo..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Torneo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full border rounded px-3 py-2"
              >
                {TOURNAMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: parseInt(e.target.value)})}
                className="w-full border rounded px-3 py-2"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máximo de Participantes</label>
            <input
              type="number"
              min={2}
              max={128}
              value={formData.max_participants}
              onChange={(e) => setFormData({...formData, max_participants: parseInt(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio de Inscripciones</label>
              <input
                type="datetime-local"
                required
                value={formData.registration_start_date}
                onChange={(e) => setFormData({...formData, registration_start_date: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cierre de Inscripciones</label>
              <input
                type="datetime-local"
                required
                value={formData.registration_end_date}
                onChange={(e) => setFormData({...formData, registration_end_date: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
              <input
                type="datetime-local"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Fin (opcional)</label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuota de Inscripción ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={formData.registration_fee}
              onChange={(e) => setFormData({...formData, registration_fee: parseFloat(e.target.value)})}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reglas</label>
            <textarea
              value={formData.rules}
              onChange={(e) => setFormData({...formData, rules: e.target.value})}
              className="w-full border rounded px-3 py-2"
              rows={4}
              placeholder="Reglas específicas del torneo..."
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => router.push('/tournaments')}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear Torneo'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
