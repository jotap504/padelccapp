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

      // Buscar usuario por número de socio o UUID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('club_id', club.id)
        .or(`member_number.eq.${identifier},id.eq.${identifier}`)
        .single()

      if (userError || !userData) {
        throw new Error('Usuario no encontrado')
      }

      // Verificar contraseña
      const { verifyPassword } = await import('./password')
      const isValid = await verifyPassword(password, userData.password_hash)

      if (!isValid) {
        throw new Error('Contraseña incorrecta')
      }

      // Crear sesión
      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        member_number: userData.member_number,
        category: userData.category,
        rating: userData.rating,
        club_id: club.id,
        club_slug: clubSlug,
      }

      const session = {
        user,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
      }

      localStorage.setItem('padel_session', JSON.stringify(session))
      setUser(user)
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    localStorage.removeItem('padel_session')
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
