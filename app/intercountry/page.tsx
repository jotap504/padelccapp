'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface IntercountryTournament {
  id: string
  name: string
  description: string
  season: number
  type: string
  category: number
  start_date: string
  status: string
  gender?: string
  list_manager_id?: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  registration: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  finished: 'bg-purple-100 text-purple-800'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  registration: 'Inscripción',
  in_progress: 'En Curso',
  finished: 'Finalizado'
}

const TYPE_LABELS: Record<string, string> = {
  league: 'Liga',
  cup: 'Copa',
  supercup: 'Supercopa'
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  mixed: 'Mixto'
}

export default function IntercountryPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournaments, setTournaments] = useState<IntercountryTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [myClubRegistered, setMyClubRegistered] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    season: new Date().getFullYear(),
    type: 'league',
    category: 4,
    gender: 'mixed' as 'male' | 'female' | 'mixed',
    start_date: '',
    registration_deadline: '',
    format: 'round_trip'
  })

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    console.log('User role:', user?.role)
    console.log('User:', user)
    setIsAdmin(user?.role === 'admin' || user?.role === 'superadmin')
    loadData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadData() {
    if (!user) return
    
    console.log('Loading intercountry tournaments...')
    
    const { data, error } = await supabase
      .from('intercountry_tournaments')
      .select('*')
      .order('season', { ascending: false })
      .order('start_date', { ascending: false })
    
    if (error) {
      console.error('Error loading tournaments:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
    }
    
    if (data) {
      console.log('Loaded tournaments:', data)
      setTournaments(data)
      
      // Check if my club is registered in any active tournament
      const { data: participant } = await supabase
        .from('intercountry_participants')
        .select('*')
        .eq('club_id', user.club_id)
        .in('tournament_id', data.filter(t => t.status !== 'finished').map(t => t.id))
        .single()
      
      setMyClubRegistered(!!participant)
    }
    
    setLoading(false)
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !isAdmin) return
    
    setCreating(true)
    
    const { error } = await supabase
      .from('intercountry_tournaments')
      .insert({
        name: formData.name,
        description: formData.description,
        season: formData.season,
        type: formData.type,
        category: formData.category,
        gender: formData.gender,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : new Date().toISOString(),
        registration_deadline: formData.registration_deadline ? new Date(formData.registration_deadline).toISOString() : null,
        format: formData.format,
        status: 'draft',
        created_by: user.id
      })
    
    if (!error) {
      setShowCreateForm(false)
      setFormData({
        name: '',
        description: '',
        season: new Date().getFullYear(),
        type: 'league',
        category: 4,
        gender: 'mixed',
        start_date: '',
        registration_deadline: '',
        format: 'round_trip'
      })
      loadData()
    } else {
      console.error('Error creating intercountry:', error)
      alert('Error al crear liga: ' + error.message)
    }
    
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Intercountrys" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Intercountrys" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Admin Create Button */}
        {isAdmin && (
          <div className="mb-6">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Crear Liga Intercountry
              </button>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Nueva Liga Intercountry</h3>
                <form onSubmit={handleCreateTournament} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
                      <input
                        type="number"
                        value={formData.season}
                        onChange={(e) => setFormData({ ...formData, season: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      >
                        {[1,2,3,4,5,6,7,8,9].map(cat => (
                          <option key={cat} value={cat}>{cat}°</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'mixed' })}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="male">Masculino</option>
                        <option value="female">Femenino</option>
                        <option value="mixed">Mixto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="league">Liga</option>
                        <option value="cup">Copa</option>
                        <option value="supercup">Supercopa</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cierre Inscripción</label>
                      <input
                        type="date"
                        value={formData.registration_deadline}
                        onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="submit"
                      disabled={creating}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creating ? 'Creando...' : 'Crear Liga'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Active Tournaments */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Torneos Activos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments
              .filter(t => t.status !== 'finished')
              .map((tournament) => (
                <div
                  key={tournament.id}
                  onClick={() => router.push(`/intercountry/${tournament.id}`)}
                  className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[tournament.status]}`}>
                      {STATUS_LABELS[tournament.status]}
                    </span>
                    <span className="text-sm text-gray-500">{tournament.season}</span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{tournament.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{tournament.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo:</span>
                      <span className="font-medium">{TYPE_LABELS[tournament.type]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Categoría:</span>
                      <span className="font-medium">{tournament.category}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Inicio:</span>
                      <span className="font-medium">
                        {new Date(tournament.start_date).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          
          {tournaments.filter(t => t.status !== 'finished').length === 0 && (
            <p className="text-gray-500 text-center py-8">No hay torneos activos</p>
          )}
        </div>

        {/* Finished Tournaments */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Torneos Finalizados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments
              .filter(t => t.status === 'finished')
              .map((tournament) => (
                <div
                  key={tournament.id}
                  onClick={() => router.push(`/intercountry/${tournament.id}`)}
                  className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow opacity-75"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      Finalizado
                    </span>
                    <span className="text-sm text-gray-500">{tournament.season}</span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{tournament.name}</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo:</span>
                      <span className="font-medium">{TYPE_LABELS[tournament.type]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Categoría:</span>
                      <span className="font-medium">{tournament.category}°</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  )
}
