import { redirect } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">PádelCC</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin/import"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Admin
              </Link>
              <button className="text-sm text-gray-500 hover:text-gray-700">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Ranking Card */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Ranking</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ver ranking general del club
            </p>
            <Link 
              href="/ranking"
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Ver ranking →
            </Link>
          </div>

          {/* Partidos Card */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Partidos</h2>
            <p className="mt-2 text-sm text-gray-600">
              Crear o ver partidos
            </p>
            <Link 
              href="/matches"
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Ver partidos →
            </Link>
          </div>

          {/* Perfil Card */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Mi Perfil</h2>
            <p className="mt-2 text-sm text-gray-600">
              Configurar categoría y datos
            </p>
            <Link 
              href="/profile"
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Editar perfil →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
