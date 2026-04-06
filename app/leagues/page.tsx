'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface League {
  id: string
  name: string
  description: string
  season: string
  category: number
  format: string
  status: string
  start_date: string
  end_date: string
  max_participants: number
  _count?: { participants: number }
}

export default function LeaguesPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'active' | 'finished'>('all')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadLeagues()
  }, [isLoading, isAuthenticated, filter])

  async function loadLeagues() {
    if (!user) return
    
    let query = supabase
      .from('leagues')
      .select('*, participants:league_participants(count)')
      .eq('club_id', user.club_id)
    
    if (filter !== 'all') {
      query = query.eq('status', filter)
    }
    
    const { data } = await query.order('created_at', { ascending: false })
    
    if (data) {
      setLeagues(data.map(l => ({ ...l, _count: { participants: l.participants } })))
    }
    setLoading(false)
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      upcoming: 'bg-gray-100 text-gray-800',
      registration: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      finished: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      upcoming: 'Próximamente',
      registration: 'Inscripción Abierta',
      active: 'En Curso',
      finished: 'Finalizada',
      cancelled: 'Cancelada'
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Ligas" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'upcoming', label: 'Próximas' },
              { key: 'registration', label: 'Inscripción' },
              { key: 'active', label: 'En Curso' },
              { key: 'finished', label: 'Finalizadas' }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leagues Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/leagues/${league.id}`)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(league.status)}`}>
                    {getStatusLabel(league.status)}
                  </span>
                  <span className="text-2xl font-bold text-gray-400">
                    {league.category}°
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-2">{league.name}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {league.description || `Liga de ${league.category}° categoría - Temporada ${league.season}`}
                </p>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>👥 {league._count?.participants || 0}/{league.max_participants}</span>
                    <span>📅 {league.season}</span>
                  </div>
                </div>
                
                {league.start_date && (
                  <p className="text-xs text-gray-400 mt-3">
                    Inicio: {new Date(league.start_date).toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
              
              <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
                <button className="w-full text-blue-600 font-medium hover:text-blue-800">
                  Ver Detalles →
                </button>
              </div>
            </div>
          ))}
        </div>

        {leagues.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">🏆</p>
            <p className="text-gray-500">No hay ligas {filter !== 'all' ? 'en esta categoría' : ''}</p>
          </div>
        )}
      </main>
    </div>
  )
}
