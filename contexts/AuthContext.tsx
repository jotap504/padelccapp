'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  club_id: string
  category?: number
}

interface Club {
  id: string
  name: string
}

interface AuthContextType {
  user: User | null
  club: Club | null
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  club: null,
  isLoading: true,
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [club, setClub] = useState<Club | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored session
    const checkSession = async () => {
      const storedUser = localStorage.getItem('user')
      const storedClub = localStorage.getItem('club')
      
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }
      if (storedClub) {
        setClub(JSON.parse(storedClub))
      }
      
      setIsLoading(false)
    }

    checkSession()
  }, [])

  return (
    <AuthContext.Provider value={{ user, club, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
