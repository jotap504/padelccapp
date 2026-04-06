'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Club {
  id: string
  name: string
}

interface Participant {
  id: string
  club_id: string
  club: Club
  status: string
  list_manager_id?: string
  list_manager?: { name: string }
}

export default function AdminIntercountryTeamsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [tournament, setTournament] = useState<any>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [availableClubs, setAvailableClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Form states
  const [selectedClubId, setSelectedClubId] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    setIsAdmin(user?.role === 'admin' || user?.role === 'superadmin')
    loadData()
  }, [isLoading, isAuthenticated, user, router])

  async function loadData() {
    if (!user) return
    
    // Load tournament
    const { data: tournamentData } = await supabase
      .from('intercountry_tournaments')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (tournamentData) {
      setTournament(tournamentData)
    }

    // Load participating clubs
    const { data: participants } = await supabase
      .from('intercountry_participants')
      .select('*')
      .eq('tournament_id', params.id)
      .order('club_id')

    if (participants) {
      // Load club details separately
      const clubIds = participants.map((p: any) => p.club_id)
      const { data: clubs } = await supabase
        .from('clubs')
        .select('id, name')
        .in('id', clubIds)
      
      const { data: managers } = await supabase
        .from('users')
        .select('id, name')
        .in('id', participants.map((p: any) => p.list_manager_id).filter(Boolean))

      const participantsWithDetails = participants.map((p: any) => ({
        ...p,
        club: clubs?.find((c: any) => c.id === p.club_id) || { id: p.club_id, name: 'Unknown' },
        list_manager: managers?.find((m: any) => m.id === p.list_manager_id)
      }))
      
      setParticipants(participantsWithDetails as any)
    }

    // Check if current club is already a participant
    const currentClubParticipant = participants?.find((p: any) => p.club_id === user.club_id)
    
    // If current club is not a participant, add it automatically
    if (!currentClubParticipant && user.club_id) {
      const { error: insertError } = await supabase
        .from('intercountry_participants')
        .insert({
          tournament_id: params.id,
          club_id: user.club_id,
          status: 'active'
        })
      
      if (insertError) {
        console.error('Error adding current club:', insertError)
        // Don't reload, just continue with existing data
      } else {
        // Reload data to include current club
        loadData()
        return
      }
    }

    // Load available clubs (not participating yet, excluding current club)
    const { data: allClubs } = await supabase
      .from('clubs')
      .select('id, name')
      .neq('id', user.club_id || '') // Exclude current club
      .order('name')

    if (allClubs && participants) {
      const participatingClubIds = participants.map((p: any) => p.club_id)
      const available = allClubs.filter(club => !participatingClubIds.includes(club.id))
      setAvailableClubs(available)
    }

    setLoading(false)
  }

  async function addParticipant() {
    if (!selectedClubId) {
      alert('Seleccioná un club')
      return
    }

    // Check if already exists
    const exists = participants.find(p => p.club_id === selectedClubId)
    if (exists) {
      alert('Este equipo ya está participando')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('intercountry_participants')
      .insert({
        tournament_id: params.id,
        club_id: selectedClubId,
        status: 'active'
      })

    if (error) {
      alert('Error al agregar equipo: ' + error.message)
    } else {
      setSelectedClubId('')
      setShowAddForm(false)
      loadData()
    }

    setSaving(false)
  }

  async function removeParticipant(participantId: string) {
    if (!confirm('¿Eliminar este equipo del torneo?')) return

    const { error } = await supabase
      .from('intercountry_participants')
      .update({ status: 'inactive' })
      .eq('id', participantId)

    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      loadData()
    }
  }

  async function activateParticipant(participantId: string) {
    const { error } = await supabase
      .from('intercountry_participants')
      .update({ status: 'active' })
      .eq('id', participantId)

    if (error) {
      alert('Error al activar: ' + error.message)
    } else {
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Administrar Equipos" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Administrar Equipos" />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">Acceso restringido. Solo administradores pueden gestionar equipos.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Administrar Equipos - ${tournament?.name || 'Intercountry'}`} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tournament Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament?.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Temporada: {tournament?.season}</span>
            <span>Categoría: {tournament?.category}°</span>
            <span>Equipos activos: {participants.filter(p => p.status === 'active').length}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <a 
              href={`/intercountry/${params.id}/admin`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              ← Volver a Fixture
            </a>
            <a 
              href={`/intercountry/${params.id}/manage`}
              className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded hover:bg-blue-50"
            >
              Gestionar Equipos
            </a>
          </div>
        </div>

        {/* Add Team */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Agregar Equipo Rival</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {showAddForm ? 'Cancelar' : 'Agregar Equipo Rival'}
            </button>
          </div>
          
          {showAddForm && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-4">
                Seleccioná los equipos rivales que participarán en este torneo intercountry.
                Tu equipo ya está incluido por defecto.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipo Rival</label>
                  <select
                    value={selectedClubId}
                    onChange={(e) => setSelectedClubId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Seleccionar equipo rival...</option>
                    {availableClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={addParticipant}
                    disabled={saving || !selectedClubId}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Agregando...' : 'Agregar Rival'}
                  </button>
                </div>
              </div>
              
              {availableClubs.length === 0 && (
                <p className="text-sm text-gray-500 mt-4">
                  No hay más equipos disponibles para agregar como rivales.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Teams List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Equipos Participantes ({participants.length})
          </h2>
          
          {participants.length > 0 ? (
            <div className="space-y-3">
              {participants.map((participant) => {
                const isCurrentClub = participant.club_id === user?.club_id
                
                return (
                  <div 
                    key={participant.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isCurrentClub 
                        ? 'bg-blue-50 border-blue-200' 
                        : participant.status === 'active' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        isCurrentClub 
                          ? 'bg-blue-500'
                          : participant.status === 'active' 
                            ? 'bg-green-500' 
                            : 'bg-gray-400'
                      }`} />
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {participant.club.name}
                          {isCurrentClub && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              Tu Equipo
                            </span>
                          )}
                        </h3>
                        {participant.list_manager && (
                          <p className="text-sm text-gray-600">
                            Capitán: {participant.list_manager.name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isCurrentClub
                          ? 'bg-blue-100 text-blue-800'
                          : participant.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isCurrentClub ? 'Equipo Local' : participant.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                      
                      {/* Don't show delete button for current club */}
                      {!isCurrentClub && (
                        <>
                          {participant.status === 'active' ? (
                            <button
                              onClick={() => removeParticipant(participant.id)}
                              className="text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          ) : (
                            <button
                              onClick={() => activateParticipant(participant.id)}
                              className="text-green-600 hover:text-green-800 px-3 py-1 rounded hover:bg-green-50"
                            >
                              Activar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No hay equipos participantes en este torneo.</p>
              <p className="text-sm mt-2">Tu equipo se agregará automáticamente al entrar.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
