'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Invitation {
  id: string
  email: string
  name: string | null
  category: number | null
  status: string
  created_at: string
  accepted_at: string | null
  invited_by: { name: string }
}

export default function InvitationsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    category: 4
  })

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadInvitations()
  }, [isLoading, isAuthenticated])

  async function loadInvitations() {
    if (!user) return
    
    const { data } = await supabase
      .from('player_invitations')
      .select('*, invited_by:users!invited_by(name)')
      .eq('club_id', user.club_id)
      .order('created_at', { ascending: false })
    
    if (data) setInvitations(data)
    setLoading(false)
  }

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    
    const { error } = await supabase.rpc('create_player_invitation', {
      p_club_id: user.club_id,
      p_invited_by: user.id,
      p_email: formData.email,
      p_name: formData.name || null,
      p_phone: formData.phone || null,
      p_category: formData.category
    })
    
    if (!error) {
      setShowCreateModal(false)
      setFormData({ email: '', name: '', phone: '', category: 4 })
      loadInvitations()
    } else {
      alert('Error: ' + error.message)
    }
  }

  async function cancelInvitation(id: string) {
    const { error } = await supabase
      .from('player_invitations')
      .update({ status: 'cancelled' })
      .eq('id', id)
    
    if (!error) {
      loadInvitations()
    }
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      accepted: 'Aceptada',
      expired: 'Expirada',
      cancelled: 'Cancelada'
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Invitaciones" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Invitaciones" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-blue-600">{invitations.length}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {invitations.filter(i => i.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-600">Pendientes</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-green-600">
              {invitations.filter(i => i.status === 'accepted').length}
            </p>
            <p className="text-sm text-gray-600">Aceptadas</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="text-2xl font-bold text-gray-600">
              {invitations.filter(i => i.status === 'expired').length}
            </p>
            <p className="text-sm text-gray-600">Expiradas</p>
          </div>
        </div>

        {/* Invitations List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Historial de Invitaciones</h2>
          </div>
          
          {invitations.length > 0 ? (
            <div className="divide-y">
              {invitations.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {inv.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{inv.name || inv.email}</p>
                      <p className="text-sm text-gray-500">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        Invitado por {inv.invited_by?.name} • {new Date(inv.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {inv.category && (
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {inv.category}° Cat
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                    {inv.status === 'pending' && (
                      <button
                        onClick={() => cancelInvitation(inv.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No hay invitaciones enviadas</p>
              <p className="text-sm mt-2">Invita a nuevos jugadores para que se unan al club</p>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Invitar Nuevo Jugador</h2>
            <form onSubmit={createInvitation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="jugador@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Nombre del jugador"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="+54 9 11 1234-5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Sugerida</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: parseInt(e.target.value)})}
                  className="w-full border rounded px-3 py-2"
                >
                  {[1,2,3,4,5,6,7,8].map(c => (
                    <option key={c} value={c}>{c}° Categoría</option>
                  ))}
                </select>
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
                  Enviar Invitación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
