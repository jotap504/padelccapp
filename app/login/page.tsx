import { redirect } from 'next/navigation'
import Link from 'next/link'
import LoginForm from './LoginForm'

export default function LoginPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ club: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Campo Chico Padel Ranking
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sistema de Gestión de Pádel
          </p>
        </div>
        
        <LoginForm />
        
        <div className="text-center text-sm text-gray-500">
          <p>¿No tienes cuenta? Contacta al administrador de tu club.</p>
        </div>
      </div>
    </div>
  )
}
