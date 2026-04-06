'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface AvailabilitySlot {
  id: string
  user_id: string
  user_name: string
  user_category: number
  date: string
  start_time: string
  end_time: string
  match_type: string
  match_type_label?: string
  court_preference: string
  court_preference_label?: string
  notes: string
}

interface MatchSuggestion {
  matching_avail_id: string
  user_id: string
  user_name: string
  user_category: number
  overlap_start: string
  overlap_end: string
  date_match: string
  score: number
}

export default function AvailabilityPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [myAvailability, setMyAvailability] = useState<AvailabilitySlot[]>([])
  const [allAvailability, setAllAvailability] = useState<AvailabilitySlot[]>([])
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    date: '',
    start_time: '18:00',
    end_time: '20:00',
    match_type: 'both',
    court_preference: 'any',
    category_preferred: '',
    notes: ''
  })

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isLoading, isAuthenticated])

  async function loadData() {
    if (!user) return
    
    // Load my availability
    const { data: myData } = await supabase
      .from('player_availability_view')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    
    if (myData) setMyAvailability(myData)
    
    // Load all club availability
    const { data: allData } = await supabase
      .from('player_availability_view')
      .select('*')
      .eq('club_id', user.club_id)
      .neq('user_id', user.id)
      .order('date', { ascending: true })
    
    if (allData) setAllAvailability(allData)
    setLoading(false)
  }

  async function findMatches(availId: string) {
    const { data } = await supabase.rpc('find_availability_matches', {
      avail_id: availId
    })
    
    if (data) setSuggestions(data)
  }

  async function createAvailability(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    
    const { error } = await supabase.from('player_availability').insert({
      user_id: user.id,
      club_id: user.club_id,
      ...formData,
      category_preferred: formData.category_preferred ? parseInt(formData.category_preferred) : null
    })
    
    if (!error) {
      setShowCreateModal(false)
      setFormData({
        date: '',
        start_time: '18:00',
        end_time: '20:00',
        match_type: 'both',
        court_preference: 'any',
        category_preferred: '',
        notes: ''
      })
      loadData()
    }
  }

  async function requestMatch(suggestion: MatchSuggestion) {
    if (!user || !selectedSlot) return
    
    const { error } = await supabase.from('availability_matches').insert({
      availability_a_id: selectedSlot.id,
      availability_b_id: suggestion.matching_avail_id,
      user_a_id: user.id,
      user_b_id: suggestion.user_id,
      proposed_date: suggestion.date_match,
      proposed_start_time: suggestion.overlap_start,
      proposed_end_time: suggestion.overlap_end,
      status: 'pending'
    })
    
    if (!error) {
      alert('Solicitud enviada!')
      setSuggestions([])
      setSelectedSlot(null)
      loadData()
    }
  }

  function getCategoryColor(cat: number) {
    const colors: Record<number, string> = {
      1: 'bg-purple-100 text-purple-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-cyan-100 text-cyan-800',
      4: 'bg-green-100 text-green-800',
      5: 'bg-yellow-100 text-yellow-800',
      6: 'bg-orange-100 text-orange-800',
      7: 'bg-red-100 text-red-800',
      8: 'bg-gray-100 text-gray-800'
    }
    return colors[cat] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Mi Disponibilidad" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Mi Disponibilidad" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* My Availability */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Mis Horarios Disponibles</h2>
          {myAvailability.length > 0 ? (
            <div className="space-y-3">
              {myAvailability.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-lg font-bold">
                        {new Date(slot.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(slot.date).toLocaleDateString('es-AR', { month: 'short' })}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {slot.match_type_label} • {slot.court_preference_label}
                      </p>
                      {slot.notes && <p className="text-xs text-gray-400">{slot.notes}</p>}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => { setSelectedSlot(slot); findMatches(slot.id); }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Buscar Rivales
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No tienes horarios disponibles registrados. Agrega uno para encontrar partidos!
            </p>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && selectedSlot && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Jugadores Disponibles</h2>
              <button 
                onClick={() => { setSuggestions([]); setSelectedSlot(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕ Cerrar
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Para el {new Date(selectedSlot.date).toLocaleDateString('es-AR')} de {selectedSlot.start_time.substring(0, 5)} a {selectedSlot.end_time.substring(0, 5)}
            </p>
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-600">
                      {suggestion.user_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{suggestion.user_name}</p>
                      <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(suggestion.user_category)}`}>
                        {suggestion.user_category}° Categoría
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        Coincide: {suggestion.overlap_start.substring(0, 5)} - {suggestion.overlap_end.substring(0, 5)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => requestMatch(suggestion)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Invitar a Jugar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Club Availability */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Disponibilidad del Club</h2>
          {allAvailability.length > 0 ? (
            <div className="space-y-3">
              {allAvailability.slice(0, 10).map((slot) => (
                <div key={slot.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-lg font-bold">
                        {new Date(slot.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">{slot.user_name}</p>
                      <p className="text-sm text-gray-500">
                        {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)} • {slot.match_type_label}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(slot.user_category)}`}>
                    {slot.user_category}°
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay otros jugadores con disponibilidad registrada
            </p>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Agregar Disponibilidad</h2>
            <form onSubmit={createAvailability} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Partido</label>
                <select
                  value={formData.match_type}
                  onChange={(e) => setFormData({...formData, match_type: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="singles">Individual</option>
                  <option value="doubles">Dobles</option>
                  <option value="both">Cualquiera</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferencia de Cancha</label>
                <select
                  value={formData.court_preference}
                  onChange={(e) => setFormData({...formData, court_preference: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="any">Indistinto</option>
                  <option value="covered">Cubierta</option>
                  <option value="uncovered">Descubierta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría Preferida de Rival (opcional)
                </label>
                <select
                  value={formData.category_preferred}
                  onChange={(e) => setFormData({...formData, category_preferred: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Cualquiera</option>
                  {[1,2,3,4,5,6,7,8].map(c => (
                    <option key={c} value={c}>{c}° Categoría</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                  placeholder="Ej: Solo mañanas, preferencia por cancha 1..."
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
