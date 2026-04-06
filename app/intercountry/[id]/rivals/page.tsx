'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface RivalClub {
  id: string
  name: string
  city?: string
  province?: string
  contact_email?: string
  contact_phone?: string
  average_rating?: number
  play_style?: string
  status: string
}

interface TournamentRival {
  id: string
  rival_club_id: string
  rival: RivalClub
  status: string
  added_at: string
}

export default function RivalClubsManagement({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<any>(null)
  const [tournamentRivals, setTournamentRivals] = useState<TournamentRival[]>([])
  const [availableRivals, setAvailableRivals] = useState<RivalClub[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'import' | 'manual' | 'current'>('import')
  
  // Manual form states
  const [manualRival, setManualRival] = useState({
    name: '',
    city: '',
    province: '',
    contact_email: '',
    contact_phone: ''
  })
  
  // Import selection states
  const [selectedRivals, setSelectedRivals] = useState<string[]>([])
  const [showImportConfirm, setShowImportConfirm] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadData() {
    if (!user) return

    try {
      // Load tournament details
      const { data: tournamentData } = await supabase
        .from('intercountry_tournaments')
        .select('*')
        .eq('id', params.id)
        .single()

      if (tournamentData) {
        setTournament(tournamentData)
      }

      // Load current tournament rivals
      const { data: rivals } = await supabase
        .from('tournament_rivals')
        .select(`
          *,
          rival:rival_clubs(*)
        `)
        .eq('tournament_id', params.id)
        .eq('status', 'active')
        .order('rival:name')

      if (rivals) {
        setTournamentRivals(rivals as any)
      }

      // Load available rivals for import
      const { data: available } = await supabase
        .rpc('get_available_rivals', {
          tournament_id_param: params.id
        })

      if (available) {
        setAvailableRivals(available)
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function importRivals() {
    if (selectedRivals.length === 0) {
      alert('Seleccioná al menos un rival para importar')
      return
    }

    if (!user) {
      alert('Error: Usuario no autenticado')
      return
    }

    setSaving(true)

    try {
      const { data, error } = await supabase
        .rpc('import_rival_clubs_to_tournament', {
          tournament_id_param: params.id,
          club_id_param: user.club_id,
          rival_ids: selectedRivals
        })

      if (error) {
        alert('Error al importar rivales: ' + error.message)
      } else {
        alert(`Se importaron ${data} rivales exitosamente`)
        setSelectedRivals([])
        setShowImportConfirm(false)
        loadData()
      }
    } catch (error) {
      console.error('Error importing rivals:', error)
      alert('Error al importar rivales')
    } finally {
      setSaving(false)
    }
  }

  async function addManualRival() {
    if (!manualRival.name.trim()) {
      alert('El nombre del rival es requerido')
      return
    }

    if (!user) {
      alert('Error: Usuario no autenticado')
      return
    }

    setSaving(true)

    try {
      // First check if rival already exists in rival_clubs table
      const { data: existingRival } = await supabase
        .from('rival_clubs')
        .select('id')
        .eq('name', manualRival.name.trim())
        .single()

      let rivalId: string
      let isNewRival = false

      if (existingRival) {
        // Use existing rival
        rivalId = existingRival.id
      } else {
        // Create new rival club
        const { data: newRival, error: createError } = await supabase
          .from('rival_clubs')
          .insert({
            name: manualRival.name.trim(),
            city: manualRival.city.trim() || null,
            province: manualRival.province.trim() || null,
            contact_email: manualRival.contact_email.trim() || null,
            contact_phone: manualRival.contact_phone.trim() || null,
            average_rating: 7.0,
            play_style: 'balanced'
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating rival:', createError)
          alert('Error al crear rival: ' + createError.message)
          setSaving(false)
          return
        }

        rivalId = newRival.id
        isNewRival = true
      }

      // Check if already added to this tournament
      const { data: existingTournamentRival } = await supabase
        .from('tournament_rivals')
        .select('id')
        .eq('tournament_id', params.id)
        .eq('rival_club_id', rivalId)
        .single()

      if (existingTournamentRival) {
        alert('Este rival ya está agregado a este torneo')
        setSaving(false)
        return
      }

      // Add to tournament
      const { error: addError } = await supabase
        .from('tournament_rivals')
        .insert({
          tournament_id: params.id,
          rival_club_id: rivalId,
          added_by_club_id: user.club_id
        })

      if (addError) {
        alert('Error al agregar rival al torneo: ' + addError.message)
      } else {
        alert(isNewRival ? 'Rival creado y agregado exitosamente' : 'Rival agregado exitosamente')
        setManualRival({
          name: '',
          city: '',
          province: '',
          contact_email: '',
          contact_phone: ''
        })
        loadData()
      }
    } catch (error) {
      console.error('Error adding manual rival:', error)
      alert('Error al agregar rival')
    } finally {
      setSaving(false)
    }
  }

  async function removeRival(rivalId: string) {
    if (!confirm('¿Eliminar este rival del torneo?')) return

    try {
      const { error } = await supabase
        .from('tournament_rivals')
        .update({ status: 'inactive' })
        .eq('id', rivalId)

      if (error) {
        alert('Error al eliminar rival: ' + error.message)
      } else {
        loadData()
      }
    } catch (error) {
      console.error('Error removing rival:', error)
      alert('Error al eliminar rival')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestión de Rivales" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Gestión de Rivales - ${tournament?.name || 'Intercountry'}`} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tournament Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament?.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Temporada: {tournament?.season}</span>
            <span>Rivales actuales: {tournamentRivals.length}</span>
            <span>Disponibles: {availableRivals.length}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <a 
              href={`/intercountry/${params.id}/dashboard`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              ← Dashboard
            </a>
            <a 
              href={`/intercountry/${params.id}/manage`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Gestionar Equipo
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'import', label: 'Importar Rivales', icon: '📥' },
                { id: 'manual', label: 'Agregar Manual', icon: '✏️' },
                { id: 'current', label: 'Rivales Actuales', icon: '👥' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Importar Rivales Existentes</h2>
              <p className="text-gray-600 mb-4">
                Seleccioná rivales de la base de datos existente para agregarlos a este torneo.
              </p>

              {availableRivals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay rivales disponibles para importar.</p>
                  <p className="text-sm mt-2">Todos los rivales ya están en este torneo o podés agregar nuevos manualmente.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {availableRivals.map((rival) => (
                      <label key={rival.id} className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedRivals.includes(rival.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRivals([...selectedRivals, rival.id])
                            } else {
                              setSelectedRivals(selectedRivals.filter(id => id !== rival.id))
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{rival.name}</h3>
                          {rival.city && rival.province && (
                            <p className="text-sm text-gray-600">{rival.city}, {rival.province}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {rival.average_rating && (
                              <span>Rating: {rival.average_rating}/10</span>
                            )}
                            {rival.play_style && (
                              <span>Estilo: {rival.play_style}</span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {selectedRivals.length} rivales seleccionados
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedRivals([])}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Limpiar Selección
                      </button>
                      <button
                        onClick={() => setShowImportConfirm(true)}
                        disabled={selectedRivals.length === 0 || saving}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Importando...' : 'Importar Seleccionados'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Agregar Rival Manualmente</h2>
              <p className="text-gray-600 mb-4">
                Agregá un nuevo club rival. Solo el nombre es obligatorio, los demás datos son opcionales.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Club *</label>
                  <input
                    type="text"
                    value={manualRival.name}
                    onChange={(e) => setManualRival({...manualRival, name: e.target.value})}
                    placeholder="Ej: Club Padel Central"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad (opcional)</label>
                  <input
                    type="text"
                    value={manualRival.city}
                    onChange={(e) => setManualRival({...manualRival, city: e.target.value})}
                    placeholder="Ciudad"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia (opcional)</label>
                  <input
                    type="text"
                    value={manualRival.province}
                    onChange={(e) => setManualRival({...manualRival, province: e.target.value})}
                    placeholder="Provincia"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
                  <input
                    type="email"
                    value={manualRival.contact_email}
                    onChange={(e) => setManualRival({...manualRival, contact_email: e.target.value})}
                    placeholder="email@club.com"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
                  <input
                    type="tel"
                    value={manualRival.contact_phone}
                    onChange={(e) => setManualRival({...manualRival, contact_phone: e.target.value})}
                    placeholder="+54 9 XXX XXXXXXX"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={addManualRival}
                  disabled={saving || !manualRival.name.trim()}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Agregando...' : 'Agregar Rival'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'current' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Rivales en el Torneo ({tournamentRivals.length})</h2>
              
              {tournamentRivals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay rivales agregados a este torneo.</p>
                  <p className="text-sm mt-2">Importá rivales existentes o agregalos manualmente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tournamentRivals.map((tournamentRival) => (
                    <div key={tournamentRival.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{tournamentRival.rival.name}</h3>
                        {tournamentRival.rival.city && tournamentRival.rival.province && (
                          <p className="text-sm text-gray-600">{tournamentRival.rival.city}, {tournamentRival.rival.province}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {tournamentRival.rival.average_rating && (
                            <span>Rating: {tournamentRival.rival.average_rating}/10</span>
                          )}
                          {tournamentRival.rival.play_style && (
                            <span>Estilo: {tournamentRival.rival.play_style}</span>
                          )}
                          <span>Agregado: {new Date(tournamentRival.added_at).toLocaleDateString('es-AR')}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activo
                        </span>
                        <button
                          onClick={() => removeRival(tournamentRival.id)}
                          className="text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import Confirmation Modal */}
        {showImportConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirmar Importación</h3>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro que querés importar {selectedRivals.length} rivales a este torneo?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportConfirm(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={importRivals}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Importando...' : 'Confirmar Importación'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
