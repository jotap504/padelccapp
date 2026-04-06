'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

interface Court {
  id: string
  name: string
  number: number
  surface: 'clay' | 'hard' | 'grass' | 'carpet'
  indoor: boolean
  lights: boolean
  status: 'active' | 'maintenance' | 'inactive'
  hourly_rate?: number
  description?: string
  created_at: string
  updated_at: string
}

interface CourtSchedule {
  id: string
  court_id: string
  day_of_week: number // 0-6 (Sunday-Saturday)
  opening_time: string
  closing_time: string
  break_start?: string
  break_end?: string
  max_booking_hours: number
}

export default function CourtsManagementPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [courts, setCourts] = useState<Court[]>([])
  const [schedules, setSchedules] = useState<CourtSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  
  const [newCourt, setNewCourt] = useState<Partial<Court>>({
    name: '',
    number: 1,
    surface: 'clay',
    indoor: false,
    lights: true,
    status: 'active',
    hourly_rate: 0
  })

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
    loadData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadData() {
    if (!user) return

    try {
      // Load courts
      const { data: courtsData } = await supabase
        .from('courts')
        .select('*')
        .eq('club_id', user.club_id)
        .order('number')

      if (courtsData) {
        setCourts(courtsData)
      }

      // Load schedules
      const { data: schedulesData } = await supabase
        .from('court_schedules')
        .select('*')
        .eq('club_id', user.club_id)
        .order('day_of_week')

      if (schedulesData) {
        setSchedules(schedulesData)
      }
    } catch (error) {
      console.error('Error loading courts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveCourt() {
    if (!user) return

    setSaving(true)

    try {
      const courtData = {
        ...newCourt,
        club_id: user.club_id
      }

      if (editingCourt) {
        // Update existing court
        const { error } = await supabase
          .from('courts')
          .update(courtData)
          .eq('id', editingCourt.id)

        if (error) {
          alert('Error al actualizar cancha: ' + error.message)
        } else {
          alert('Cancha actualizada exitosamente')
          setShowAddModal(false)
          setEditingCourt(null)
          loadData()
        }
      } else {
        // Create new court
        const { error } = await supabase
          .from('courts')
          .insert(courtData)

        if (error) {
          alert('Error al crear cancha: ' + error.message)
        } else {
          alert('Cancha creada exitosamente')
          setShowAddModal(false)
          setNewCourt({
            name: '',
            number: courts.length + 1,
            surface: 'clay',
            indoor: false,
            lights: true,
            status: 'active',
            hourly_rate: 0
          })
          loadData()
        }
      }
    } catch (error) {
      console.error('Error saving court:', error)
      alert('Error al guardar cancha')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCourt(courtId: string) {
    if (!confirm('¿Estás seguro que querés eliminar esta cancha?')) return

    try {
      const { error } = await supabase
        .from('courts')
        .delete()
        .eq('id', courtId)

      if (error) {
        alert('Error al eliminar cancha: ' + error.message)
      } else {
        alert('Cancha eliminada exitosamente')
        loadData()
      }
    } catch (error) {
      console.error('Error deleting court:', error)
      alert('Error al eliminar cancha')
    }
  }

  function editCourt(court: Court) {
    setEditingCourt(court)
    setNewCourt(court)
    setShowAddModal(true)
  }

  function getSurfaceIcon(surface: string) {
    switch (surface) {
      case 'clay': return '🏮'
      case 'hard': return '💎'
      case 'grass': return '🌱'
      case 'carpet': return '🟦'
      default: return '🏟️'
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p>Cargando canchas...</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Canchas</h1>
              <p className="text-gray-600">
                Administra las canchas disponibles en tu club.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCourt(null)
                setNewCourt({
                  name: '',
                  number: courts.length + 1,
                  surface: 'clay',
                  indoor: false,
                  lights: true,
                  status: 'active',
                  hourly_rate: 0
                })
                setShowAddModal(true)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Agregar Cancha
            </button>
          </div>
        </div>

        {/* Courts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courts.map((court) => (
            <div key={court.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Cancha {court.number}
                  </h3>
                  <p className="text-gray-600">{court.name}</p>
                </div>
                <span className="text-2xl">
                  {getSurfaceIcon(court.surface)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Superficie:</span>
                  <span className="text-sm font-medium capitalize">{court.surface}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Tipo:</span>
                  <span className="text-sm font-medium">
                    {court.indoor ? 'Techada' : 'Al aire libre'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Luces:</span>
                  <span className="text-sm font-medium">
                    {court.lights ? '✅ Sí' : '❌ No'}
                  </span>
                </div>

                {court.hourly_rate && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Tarifa:</span>
                    <span className="text-sm font-medium">
                      ${court.hourly_rate}/hora
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(court.status)}`}>
                    {court.status === 'active' ? 'Activa' : 
                     court.status === 'maintenance' ? 'Mantenimiento' : 'Inactiva'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => editCourt(court)}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteCourt(court.id)}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{courts.length}</div>
              <div className="text-sm text-gray-600">Total Canchas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {courts.filter(c => c.status === 'active').length}
              </div>
              <div className="text-sm text-gray-600">Activas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {courts.filter(c => c.status === 'maintenance').length}
              </div>
              <div className="text-sm text-gray-600">Mantenimiento</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {courts.filter(c => c.status === 'inactive').length}
              </div>
              <div className="text-sm text-gray-600">Inactivas</div>
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold mb-4">
                {editingCourt ? 'Editar Cancha' : 'Agregar Nueva Cancha'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Cancha
                  </label>
                  <input
                    type="number"
                    value={newCourt.number}
                    onChange={(e) => setNewCourt({...newCourt, number: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newCourt.name}
                    onChange={(e) => setNewCourt({...newCourt, name: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ej: Cancha Principal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Superficie
                  </label>
                  <select
                    value={newCourt.surface}
                    onChange={(e) => setNewCourt({...newCourt, surface: e.target.value as any})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="clay">Polvo de Ladrillo</option>
                    <option value="hard">Dura</option>
                    <option value="grass">Césped</option>
                    <option value="carpet">Alfombra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={newCourt.indoor ? 'indoor' : 'outdoor'}
                    onChange={(e) => setNewCourt({...newCourt, indoor: e.target.value === 'indoor'})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="outdoor">Al aire libre</option>
                    <option value="indoor">Techada</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newCourt.lights}
                      onChange={(e) => setNewCourt({...newCourt, lights: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium">Tiene luces</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarifa por Hora
                  </label>
                  <input
                    type="number"
                    value={newCourt.hourly_rate || ''}
                    onChange={(e) => setNewCourt({...newCourt, hourly_rate: parseFloat(e.target.value) || undefined})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={newCourt.status}
                    onChange={(e) => setNewCourt({...newCourt, status: e.target.value as any})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="active">Activa</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveCourt}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
