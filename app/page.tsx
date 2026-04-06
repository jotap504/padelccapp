'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }
  }, [isLoading, isAuthenticated, router])

  // Loading state
  return (
    <div className='flex items-center justify-center h-screen bg-gray-900'>
      <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500'></div>
    </div>
  )
}