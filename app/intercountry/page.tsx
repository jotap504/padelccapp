'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

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
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              🏆 Torneos Intercountry
            </h1>
            <p className="text-purple-100 text-lg">
              Competiciones entre clubes de diferentes regiones
            </p>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Admin Create Button */}
        {isAdmin && (
          <div className="mb-6">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105"
              >
                + Crear Liga Intercountry
              </button>
            ) : (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 mb-6 shadow-xl">
                <h3 className="text-lg font-semibold mb-4 text-white">Nueva Liga Intercountry</h3>
                <form onSubmit={handleCreateTournament} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Temporada</label>
                      <input
                        type="number"
                        value={formData.season}
                        onChange={(e) => setFormData({ ...formData, season: parseInt(e.target.value) })}
                        className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Categoría</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: parseInt(e.target.value) })}
                        className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {[1,2,3,4,5,6,7,8,9].map(cat => (
                          <option key={cat} value={cat}>{cat}°</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Género</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'mixed' })}
                        className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="male">Masculino</option>
                        <option value="female">Femenino</option>
                        <option value="mixed">Mixto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="league">Liga</option>
                        <option value="cup">Copa</option>
                        <option value="supercup">Supercopa</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Inicio</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Cierre Inscripción</label>
                      <input
                        type="date"
                        value={formData.registration_deadline}
                        onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                        className="w-full border border-gray-600 rounded-lg px-4 py-2 bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="submit"
                      disabled={creating}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 transition-all duration-300"
                    >
                      {creating ? 'Creando...' : 'Crear Liga'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
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
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚡</span> Torneos Activos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments
              .filter(t => t.status !== 'finished')
              .map((tournament) => (
                <div
                  key={tournament.id}
                  onClick={() => router.push(`/intercountry/${tournament.id}`)}
                  className="group relative overflow-hidden rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6 cursor-pointer hover:border-purple-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 opacity-10 rounded-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        tournament.status === 'draft' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' :
                        tournament.status === 'registration' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        tournament.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {STATUS_LABELS[tournament.status]}
                      </span>
                      <span className="text-sm text-gray-400">{tournament.season}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">{tournament.name}</h3>
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">{tournament.description}</p>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tipo:</span>
                        <span className="font-medium text-gray-300">{TYPE_LABELS[tournament.type]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Categoría:</span>
                        <span className="font-medium text-gray-300">{tournament.category}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Inicio:</span>
                        <span className="font-medium text-gray-300">
                          {new Date(tournament.start_date).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {tournaments.filter(t => t.status !== 'finished').length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl">
              <p className="text-4xl mb-2">🏆</p>
              <p>No hay torneos activos</p>
            </div>
          )}
        </div>

        {/* Finished Tournaments */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>🏅</span> Torneos Finalizados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments
              .filter(t => t.status === 'finished')
              .map((tournament) => (
                <div
                  key={tournament.id}
                  onClick={() => router.push(`/intercountry/${tournament.id}`)}
                  className="group relative overflow-hidden rounded-xl bg-gray-800/30 backdrop-blur-sm border border-gray-700 p-6 cursor-pointer hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02] opacity-75"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      Finalizado
                    </span>
                    <span className="text-sm text-gray-400">{tournament.season}</span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-300 mb-2 group-hover:text-purple-400 transition-colors">{tournament.name}</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo:</span>
                      <span className="font-medium text-gray-400">{TYPE_LABELS[tournament.type]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Categoría:</span>
                      <span className="font-medium text-gray-400">{tournament.category}°</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>
      </div>
    </MainLayout>
  )
}
