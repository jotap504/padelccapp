'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string | null
  member_number: string | null
  category: number | null
  rating: number | null
  club_id: string
  club_slug: string
  role: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (clubSlug: string, identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Verificar sesión al cargar
  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    try {
      const session = localStorage.getItem('padel_session')
      if (session) {
        const parsed = JSON.parse(session)
        // Validar que el ID no sea un placeholder
        if (parsed.user?.id === '11111111-1111-1111-1111-111111111111') {
          console.error('Sesión corrupta detectada, limpiando...')
          localStorage.removeItem('padel_session')
          setUser(null)
          return
        }
        if (parsed.expires_at > Date.now()) {
          setUser(parsed.user)
        } else {
          localStorage.removeItem('padel_session')
        }
      }
    } catch (error) {
      console.error('Error checking session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function login(clubSlug: string, identifier: string, password: string) {
    setIsLoading(true)
    try {
      // Obtener club
      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('id')
        .eq('slug', clubSlug)
        .single()

      if (clubError || !club) {
        throw new Error('Club no encontrado')
      }

      // Buscar usuario por número de socio PRIMERO
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('club_id', club.id)
        .eq('member_number', identifier)
        .single()

      // Si no se encontró por member_number, intentar por UUID (id)
      if (!userData && !userError) {
        const result = await supabase
          .from('users')
          .select('*')
          .eq('club_id', club.id)
          .eq('id', identifier)
          .single()
        
        userData = result.data
        userError = result.error
      }

      if (userError || !userData) {
        throw new Error('Usuario no encontrado')
      }

      // Verificar contraseña
      const { verifyPassword } = await import('./password')
      const isValid = await verifyPassword(password, userData.password_hash)

      if (!isValid) {
        throw new Error('Contraseña incorrecta')
      }

      // Crear sesión en localStorage
      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        member_number: userData.member_number,
        category: userData.category,
        rating: userData.rating,
        club_id: club.id,
        club_slug: clubSlug,
        role: userData.role || 'user',
      }

      const session = {
        user,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
      }

      localStorage.setItem('padel_session', JSON.stringify(session))
      setUser(user)
      
      // Also create Supabase session for API calls
      await supabase.auth.setSession({
        access_token: 'custom_token_' + userData.id,
        refresh_token: 'custom_refresh_' + userData.id,
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    localStorage.removeItem('padel_session')
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
