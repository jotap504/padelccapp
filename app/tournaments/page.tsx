'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Tournament {
  id: string
  name: string
  description: string
  type: string
  category: number
  max_participants: number
  registration_start_date: string
  registration_end_date: string
  start_date: string
  status: string
  _count?: { registrations: number }
}

const TOURNAMENT_TYPES: Record<string, string> = {
  single_elimination: 'Eliminación Simple',
  double_elimination: 'Eliminación Doble',
  round_robin: 'Todos contra Todos',
  swiss: 'Suizo',
  americano: 'Americano',
  liga: 'Liga'
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  mixed: 'Mixto'
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  registration_open: 'bg-green-100 text-green-800',
  registration_closed: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  finished: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  registration_open: 'Inscripción Abierta',
  registration_closed: 'Inscripción Cerrada',
  in_progress: 'En Curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado'
}

export default function TournamentsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'single_elimination',
    format_type: 'americano',
    category: 4,
    gender: 'mixed' as 'male' | 'female' | 'mixed',
    max_participants: 16,
    location: '',
    start_date: '',
    start_time: '',
    duration_hours: 4,
    eligible_categories: [] as number[],
    registration_start_date: '',
    registration_end_date: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
  async function loadTournaments() {
    if (!user) return
    
    const { data } = await supabase
      .from('tournaments')
      .select('*, registrations:tournament_registrations(count)')
      .eq('club_id', user.club_id)
      .order('start_date', { ascending: false })
    
    if (data) {
      setTournaments(data.map(t => ({ ...t, _count: { registrations: t.registrations?.[0]?.count || 0 } })))
    }
    setLoading(false)
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !isAdmin) return
    
    setCreating(true)
    
    // Convert date inputs to full ISO timestamps for PostgreSQL
    const startDateTime = formData.start_date 
      ? new Date(`${formData.start_date}T${formData.start_time || '09:00'}`).toISOString()
      : new Date().toISOString()
    
    const regEndDateTime = formData.registration_end_date
      ? new Date(`${formData.registration_end_date}T23:59:59`).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { error } = await supabase
      .from('tournaments')
      .insert({
        club_id: user.club_id,
        created_by: user.id,
        name: formData.name,
        description: formData.description,
        type: formData.format_type === 'americano' ? 'single_elimination' : formData.type,
        format_type: formData.format_type,
        category: formData.category,
        gender: formData.gender,
        max_participants: formData.max_participants,
        location: formData.location,
        start_date: startDateTime,
        start_time: formData.start_time,
        duration_hours: formData.duration_hours,
        eligible_categories: formData.eligible_categories.length > 0 ? formData.eligible_categories : null,
        registration_start_date: new Date().toISOString(),
        registration_end_date: regEndDateTime,
        status: 'registration_open',
        notify_members: true
      })
    
    if (!error) {
      setShowCreateForm(false)
      setFormData({
        name: '',
        description: '',
        type: 'single_elimination',
        format_type: 'americano',
        category: 4,
        gender: 'mixed',
        max_participants: 16,
        location: '',
        start_date: '',
        start_time: '',
        duration_hours: 4,
        eligible_categories: [],
        registration_start_date: '',
        registration_end_date: ''
      })
      loadTournaments()
    } else {
      console.error('Error creating tournament:', error)
      alert('Error al crear torneo: ' + error.message)
    }
    
    setCreating(false)
  }

  const toggleCategory = (cat: number) => {
    setFormData(prev => ({
      ...prev,
      eligible_categories: prev.eligible_categories.includes(cat)
        ? prev.eligible_categories.filter(c => c !== cat)
        : [...prev.eligible_categories, cat].sort()
    }))
  }
    
    // Check if user is admin
    setIsAdmin(user?.role === 'admin' || user?.role === 'superadmin')
    
    loadTournaments()
  }, [isLoading, isAuthenticated, router, user])

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'all') return true
    if (filter === 'open') return t.status === 'registration_open'
    if (filter === 'active') return t.status === 'in_progress'
    if (filter === 'finished') return t.status === 'finished'
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Torneos" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Torneos" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 flex space-x-2">
          {(['all', 'open', 'active', 'finished'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded ${
                filter === f 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f === 'all' && 'Todos'}
              {f === 'open' && 'Inscripción Abierta'}
              {f === 'active' && 'En Curso'}
              {f === 'finished' && 'Finalizados'}
            </button>
          ))}
        </div>

        {/* Tournaments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament, index) => (
            <div
              key={`tournament-${tournament.id}-${index}`}
              onClick={() => router.push(`/tournaments/${tournament.id}`)}
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[tournament.status]}`}>
                  {STATUS_LABELS[tournament.status]}
                </span>
                <span className="text-sm text-gray-500">
                  {tournament._count?.registrations || 0}/{tournament.max_participants}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-2">{tournament.name}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{tournament.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo:</span>
                  <span className="font-medium">{TOURNAMENT_TYPES[tournament.type]}</span>
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

              {tournament.status === 'registration_open' && (
                <button className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                  Inscribirme
                </button>
              )}
            </div>
          ))}
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No hay torneos en esta categoría</p>
          </div>
        )}
      </main>
    </div>
  )
}
