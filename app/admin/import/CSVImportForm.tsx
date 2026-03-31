'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase/client'
import { hashPassword } from '@/lib/auth/password'

interface CSVRow {
  nombre: string
  sexo: string
  numero_socio: string
}

interface PreviewData {
  valid: boolean
  totalRows: number
  validRows: number
  errors: Array<{ row: number; message: string }>
  preview: Array<{
    nombre: string
    sexo: string
    numero_socio: string
  }>
}

export default function CSVImportForm() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
    imported?: number
    errors?: number
  } | null>(null)
  const [clubSlug, setClubSlug] = useState('demo-club')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0]
    if (csvFile) {
      setFile(csvFile)
      validateCSV(csvFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  })

  function validateCSV(csvFile: File) {
    Papa.parse(csvFile, {
      header: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const data = results.data as CSVRow[]
        const errors: Array<{ row: number; message: string }> = []
        const validRows: Array<{ nombre: string; sexo: string; numero_socio: string }> = []

        data.forEach((row, index) => {
          const rowNum = index + 2 // +2 porque empezamos en 1 y hay header

          // Validar nombre
          if (!row.nombre || row.nombre.trim() === '') {
            errors.push({ row: rowNum, message: 'Nombre vacío' })
            return
          }

          // Validar sexo
          const sexo = row.sexo?.toUpperCase().trim()
          if (!sexo || !['M', 'F'].includes(sexo)) {
            errors.push({ row: rowNum, message: 'Sexo debe ser M o F' })
            return
          }

          // Validar número de socio
          if (!row.numero_socio || row.numero_socio.trim() === '') {
            errors.push({ row: rowNum, message: 'Número de socio vacío' })
            return
          }

          validRows.push({
            nombre: row.nombre.trim(),
            sexo: sexo,
            numero_socio: row.numero_socio.trim(),
          })
        })

        setPreview({
          valid: errors.length === 0,
          totalRows: data.length,
          validRows: validRows.length,
          errors,
          preview: validRows.slice(0, 5), // Primeros 5 para preview
        })
      },
      error: (error) => {
        console.error('Error parsing CSV:', error)
        setPreview({
          valid: false,
          totalRows: 0,
          validRows: 0,
          errors: [{ row: 0, message: 'Error al leer el archivo CSV' }],
          preview: [],
        })
      },
    })
  }

  async function handleImport() {
    if (!file || !preview || !preview.valid) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      // Obtener club_id
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('slug', clubSlug)
        .single()

      if (!club) {
        throw new Error('Club no encontrado')
      }

      // Leer y parsear CSV completo
      const results = await new Promise<Papa.ParseResult<CSVRow>>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          encoding: 'UTF-8',
          complete: resolve,
          error: reject,
        })
      })

      const data = results.data as CSVRow[]
      const defaultPassword = await hashPassword('100')

      // Preparar usuarios para insertar
      const usersToInsert = data
        .filter((row) => row.nombre && row.sexo && row.numero_socio)
        .map((row) => ({
          club_id: club.id,
          name: row.nombre.trim(),
          gender: row.sexo.toUpperCase().trim(),
          member_number: row.numero_socio.trim(),
          password_hash: defaultPassword,
          status: 'active',
          imported_from_csv: true,
          auth_provider: 'imported',
          category: null,
          rating: null,
          initial_category: null,
        }))

      if (usersToInsert.length === 0) {
        throw new Error('No hay usuarios válidos para importar')
      }

      // Insertar usuarios (manejar duplicados)
      const { data: inserted, error } = await supabase
        .from('users')
        .upsert(usersToInsert, {
          onConflict: 'club_id,member_number',
          ignoreDuplicates: false, // Actualizar si ya existe
        })
        .select()

      if (error) {
        throw error
      }

      // Registrar importación
      await supabase.from('player_imports').insert({
        club_id: club.id,
        filename: file.name,
        row_count: data.length,
        success_count: inserted?.length || 0,
        error_count: data.length - (inserted?.length || 0),
        status: 'completed',
      })

      setUploadResult({
        success: true,
        message: `Importación exitosa: ${inserted?.length || 0} jugadores importados`,
        imported: inserted?.length,
      })

      // Limpiar
      setFile(null)
      setPreview(null)
    } catch (error: any) {
      console.error('Error importing:', error)
      setUploadResult({
        success: false,
        message: error.message || 'Error al importar jugadores',
        errors: 1,
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Selector de club */}
      <div>
        <label htmlFor="club-slug" className="block text-sm font-medium text-gray-700">
          ID del Club
        </label>
        <input
          type="text"
          id="club-slug"
          value={clubSlug}
          onChange={(e) => setClubSlug(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="demo-club"
        />
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <p className="text-sm text-gray-700">
            Archivo seleccionado: <strong>{file.name}</strong>
          </p>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              {isDragActive
                ? 'Suelta el archivo aquí...'
                : 'Arrastra y suelta un archivo CSV aquí, o haz click para seleccionar'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Solo archivos .csv
            </p>
          </div>
        )}
      </div>

      {/* Preview de validación */}
      {preview && (
        <div className={`rounded-md p-4 ${preview.valid ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <h4 className="text-sm font-medium text-gray-900">
            Validación: {preview.valid ? 'Exitosa' : 'Con errores'}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            Total: {preview.totalRows} filas | Válidas: {preview.validRows}
          </p>

          {preview.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-700">Errores:</p>
              <ul className="mt-1 text-xs text-red-600 space-y-1">
                {preview.errors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>Fila {error.row}: {error.message}</li>
                ))}
                {preview.errors.length > 5 && (
                  <li>... y {preview.errors.length - 5} errores más</li>
                )}
              </ul>
            </div>
          )}

          {preview.preview.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Vista previa (primeros 5):</p>
              <ul className="mt-1 text-xs text-gray-600 space-y-1">
                {preview.preview.map((row, idx) => (
                  <li key={idx}>
                    {row.nombre} ({row.sexo}) - Socio: {row.numero_socio}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Botón importar */}
      {preview?.valid && (
        <button
          onClick={handleImport}
          disabled={isUploading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Importando...' : `Importar ${preview.validRows} jugadores`}
        </button>
      )}

      {/* Resultado */}
      {uploadResult && (
        <div
          className={`rounded-md p-4 ${
            uploadResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          <p className="text-sm font-medium">{uploadResult.message}</p>
        </div>
      )}
    </div>
  )
}
