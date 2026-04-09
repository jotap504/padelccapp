'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import MainLayout from '@/app/components/MainLayout'

const CATEGORIES = [
  { value: 1, label: '1ra (1400 pts)', rating: 1400 },
  { value: 2, label: '2da (1250 pts)', rating: 1250 },
  { value: 3, label: '3ra (1100 pts)', rating: 1100 },
  { value: 4, label: '4ta (950 pts)', rating: 950 },
  { value: 5, label: '5ta (850 pts)', rating: 850 },
  { value: 6, label: '6ta (750 pts)', rating: 750 },
  { value: 7, label: '7ma (650 pts)', rating: 650 },
  { value: 8, label: '8va (550 pts)', rating: 550 },
]

const HANDEDNESS = [
  { value: 'right', label: 'Diestro' },
  { value: 'left', label: 'Zurdo' },
  { value: 'unknown', label: 'No especificar' },
]

const SIDES = [
  { value: 'drive', label: 'Drive (derecha)' },
  { value: 'backhand', label: 'Revés (izquierda)' },
  { value: 'both', label: 'Ambos' },
  { value: 'unknown', label: 'No especificar' },
]

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  
  // Form fields
  const [category, setCategory] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [handedness, setHandedness] = useState('unknown')
  const [preferredSide, setPreferredSide] = useState('unknown')
  const [emailNotifications, setEmailNotifications] = useState(true)
  
  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    // Esperar a que AuthContext termine de cargar
    if (isLoading) return
    
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    loadUserData()
  }, [isLoading, isAuthenticated, user])

  async function loadUserData() {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      
      if (data) {
        setCategory(data.initial_category?.toString() || '')
        setEmail(data.email || '')
        setWhatsappPhone(data.whatsapp_phone || '')
        setHandedness(data.handedness || 'unknown')
        setPreferredSide(data.preferred_side || 'unknown')
        setEmailNotifications(data.email_notifications ?? true)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    
    setSaving(true)
    setMessage('')
    
    try {
      const selectedCategory = parseInt(category)
      const selectedRating = CATEGORIES.find(c => c.value === selectedCategory)?.rating || 750
      
      const { error } = await supabase
        .from('users')
        .update({
          initial_category: selectedCategory,
          category: selectedCategory,
          rating: selectedRating,
          email: email || null,
          whatsapp_phone: whatsappPhone || null,
          handedness,
          preferred_side: preferredSide,
          email_notifications: emailNotifications,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      
      if (error) throw error
      
      setMessage('Perfil actualizado correctamente')
    } catch (error: any) {
      setMessage('Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setPasswordMessage('')

    if (newPassword !== confirmPassword) {
      setPasswordMessage('Error: Las contraseñas no coinciden')
      return
    }

    if (newPassword.length < 3) {
      setPasswordMessage('Error: La contraseña debe tener al menos 3 caracteres')
      return
    }

    setChangingPassword(true)

    try {
      // Verificar contraseña actual
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single()

      if (fetchError || !userData) {
        throw new Error('No se pudo verificar la contraseña actual')
      }

      const { verifyPassword, hashPassword } = await import('@/lib/auth/password')
      const isValid = await verifyPassword(currentPassword, userData.password_hash)

      if (!isValid) {
        setPasswordMessage('Error: Contraseña actual incorrecta')
        return
      }

      // Actualizar contraseña
      const newHash = await hashPassword(newPassword)
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (updateError) throw updateError

      setPasswordMessage('Contraseña actualizada correctamente')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (error: any) {
      setPasswordMessage('Error: ' + error.message)
    } finally {
      setChangingPassword(false)
    }
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

  const needsCategory = !category

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">⚙️ Mi Perfil</h1>
          <p className="text-blue-100">Configuración de tu cuenta</p>
        </div>

        {/* Main content */}
        <main className="mx-auto max-w-2xl">
          {needsCategory && (
            <div className="mb-6 rounded-xl bg-blue-500/20 border border-blue-500/30 p-4">
              <p className="text-sm text-blue-300">
                <strong>¡Bienvenido!</strong> Por favor, seleccioná tu categoría para completar tu perfil y empezar a jugar.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6 rounded-xl">
            {/* Category - Required */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-300">
                Categoría <span className="text-red-400">*</span>
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Seleccionar categoría...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Elegí la categoría en la que creés que jugás. El sistema la validará automáticamente con tu rendimiento.
              </p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email (opcional)
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="tu@email.com"
              />
              <p className="mt-1 text-xs text-gray-400">
                Necesario para recuperar tu contraseña
              </p>
            </div>

            {/* WhatsApp */}
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-300">
                WhatsApp (opcional)
              </label>
              <input
                type="tel"
                id="whatsapp"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="+5491123456789"
              />
            </div>

            {/* Handedness */}
            <div>
              <label htmlFor="handedness" className="block text-sm font-medium text-gray-300">
                Diestro/Zurdo
              </label>
              <select
                id="handedness"
                value={handedness}
                onChange={(e) => setHandedness(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {HANDEDNESS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Preferred Side */}
            <div>
              <label htmlFor="side" className="block text-sm font-medium text-gray-300">
                Lado preferido en la cancha
              </label>
              <select
                id="side"
                value={preferredSide}
                onChange={(e) => setPreferredSide(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {SIDES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Email Notifications */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="notifications"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="notifications" className="ml-2 block text-sm text-gray-300">
                Recibir notificaciones por email
              </label>
            </div>

            {/* Message */}
            {message && (
              <div className={`rounded-md p-3 ${message.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </form>

          {/* Password Change Section */}
          <div className="mt-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-6 rounded-xl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Cambiar Contraseña</h2>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {showPasswordForm ? 'Cancelar' : 'Cambiar contraseña'}
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300">
                    Contraseña actual
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                {passwordMessage && (
                  <div className={`rounded-md p-3 ${passwordMessage.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    <p className="text-sm">{passwordMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </MainLayout>
  )
}
