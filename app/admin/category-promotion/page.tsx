'use client'

import { Suspense } from 'react'
import CategoryPromotionContent from './CategoryPromotionContent'

export default function CategoryPromotionPage() {
  return (
    <Suspense fallback={
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500'></div>
      </div>
    }>
      <CategoryPromotionContent />
    </Suspense>
  )
}