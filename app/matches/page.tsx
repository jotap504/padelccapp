'use client'

import { Suspense } from 'react'
import MatchesContent from './MatchesContent'

export default function MatchesPage() {
  return (
    <Suspense fallback={
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500'></div>
      </div>
    }>
      <MatchesContent />
    </Suspense>
  )
}