import { redirect } from 'next/navigation'
import Link from 'next/link'
import CSVImportForm from './CSVImportForm'

export default function AdminImportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                ← Volver
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Importación CSV */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Importar Jugadores (CSV)</h2>
            <p className="mt-2 text-sm text-gray-600">
              Sube un archivo CSV con columnas: nombre, sexo (M/F), numero_socio
            </p>
            <div className="mt-4">
              <CSVImportForm />
            </div>
          </div>

          {/* Instrucciones */}
          <div className="rounded-lg bg-blue-50 p-6">
            <h3 className="text-md font-semibold text-blue-900">Formato CSV requerido</h3>
            <div className="mt-3 space-y-2 text-sm text-blue-800">
              <p>El archivo CSV debe contener las siguientes columnas:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>nombre</strong> - Nombre completo del jugador</li>
                <li><strong>sexo</strong> - M (masculino) o F (femenino)</li>
                <li><strong>numero_socio</strong> - Número de socio del club</li>
              </ul>
              <p className="mt-3">Los jugadores importados tendrán:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Contraseña por defecto: <strong>100</strong></li>
                <li>Deberán elegir su categoría (1ra-8va) en el primer login</li>
                <li>Podrán completar email y teléfono opcionalmente</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
