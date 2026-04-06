'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Court {
  id: string
  name: string
  court_number: number
  type: string
  has_lighting: boolean
  status: string
}

interface Booking {
  id: string
  court_id: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  booked_by: { name: string }
  players: any[]
  notes: string
}

interface TimeSlot {
  start: string
  end: string
  available: boolean
  booking?: Booking
}

export default function CourtBookingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  
  const [courts, setCourts] = useState<Court[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [selectedCourt, setSelectedCourt] = useState<string>('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [bookingNotes, setBookingNotes] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadCourts()
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    if (selectedDate && selectedCourt) {
      loadBookings()
    }
  }, [selectedDate, selectedCourt])

  async function loadCourts() {
    if (!user) return
    
    const { data } = await supabase
      .from('courts')
      .select('*')
      .eq('club_id', user.club_id)
      .eq('status', 'active')
      .order('court_number')
    
    if (data) {
      setCourts(data)
      if (data.length > 0) {
        setSelectedCourt(data[0].id)
      }
    }
    setLoading(false)
  }

  async function loadBookings() {
    if (!selectedCourt || !selectedDate) return
    
    const { data } = await supabase
      .from('court_bookings')
      .select('*, booked_by:booked_by(name)')
      .eq('court_id', selectedCourt)
      .eq('booking_date', selectedDate)
      .in('status', ['pending', 'confirmed'])
    
    if (data) {
      setBookings(data)
      generateSlots(data)
    }
  }

  function generateSlots(existingBookings: Booking[]) {
    const slots: TimeSlot[] = []
    const startHour = 8
    const endHour = 23
    
    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`
      
      // Verificar si está reservado
      const booking = existingBookings.find(b => {
        const bStart = b.start_time.substring(0, 5)
        const bEnd = b.end_time.substring(0, 5)
        return bStart <= startTime && bEnd > startTime
      })
      
      slots.push({
        start: startTime,
        end: endTime,
        available: !booking,
        booking
      })
    }
    
    setSlots(slots)
  }

  async function createBooking() {
    if (!user || !selectedCourt || !selectedDate || !selectedSlot) return
    
    const { error } = await supabase.rpc('create_booking', {
      p_club_id: user.club_id,
      p_court_id: selectedCourt,
      p_booked_by: user.id,
      p_booking_date: selectedDate,
      p_start_time: selectedSlot.start,
      p_end_time: selectedSlot.end,
      p_booking_type: 'casual',
      p_players: JSON.stringify([{ user_id: user.id }]),
      p_notes: bookingNotes
    })
    
    if (!error) {
      setShowModal(false)
      setBookingNotes('')
      setSelectedSlot(null)
      loadBookings()
    } else {
      alert('Error al reservar: ' + error.message)
    }
  }

  async function cancelBooking(bookingId: string) {
    if (!user) return
    
    const confirmed = confirm('¿Estás seguro de que querés cancelar esta reserva?')
    if (!confirmed) return
    
    const { error } = await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_cancelled_by: user.id,
      p_reason: 'Cancelado por usuario'
    })
    
    if (!error) {
      loadBookings()
    }
  }

  function getCourtTypeIcon(type: string): string {
    return type === 'indoor' ? '🏠' : type === 'outdoor' ? '☀️' : '🏗️'
  }

  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    weekDays.push({
      date: d.toISOString().split('T')[0],
      day: d.toLocaleDateString('es-AR', { weekday: 'short' }),
      dayNum: d.getDate()
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Reserva de Canchas" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Date Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex space-x-2 overflow-x-auto">
            {weekDays.map((d) => (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`flex flex-col items-center min-w-[80px] p-3 rounded-lg transition-colors ${
                  selectedDate === d.date
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="text-sm uppercase">{d.day}</span>
                <span className="text-xl font-bold">{d.dayNum}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Courts List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="font-semibold text-gray-700 mb-3">Canchas</h3>
            {courts.map((court) => (
              <button
                key={court.id}
                onClick={() => setSelectedCourt(court.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedCourt === court.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{court.name}</span>
                  <span>{getCourtTypeIcon(court.type)}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {court.type === 'indoor' ? 'Interior' : 'Exterior'}
                  {court.has_lighting && ' • 💡 Iluminada'}
                </div>
              </button>
            ))}
          </div>

          {/* Time Slots */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-semibold">
                  Horarios - {new Date(selectedDate).toLocaleDateString('es-AR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {slots.map((slot, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      slot.available
                        ? 'border-green-300 bg-green-50 cursor-pointer hover:bg-green-100'
                        : 'border-red-300 bg-red-50'
                    }`}
                    onClick={() => {
                      if (slot.available) {
                        setSelectedSlot(slot)
                        setShowModal(true)
                      }
                    }}
                  >
                    <div className="text-center">
                      <p className="font-bold text-lg">{slot.start}</p>
                      <p className="text-sm text-gray-500">a {slot.end}</p>
                      {slot.available ? (
                        <p className="text-xs text-green-600 font-medium mt-1">Disponible</p>
                      ) : (
                        <p className="text-xs text-red-600 font-medium mt-1">
                          Ocupado
                          {slot.booking?.booked_by && (
                            <span className="block text-gray-500">
                              por {slot.booking.booked_by.name}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* My Bookings */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Mis Reservas</h3>
          </div>
          <div className="p-4">
            {bookings.filter(b => b.booked_by?.name === user?.name).length > 0 ? (
              <div className="space-y-3">
                {bookings
                  .filter(b => b.booked_by?.name === user?.name)
                  .map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">
                          {courts.find(c => c.id === booking.court_id)?.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(booking.booking_date).toLocaleDateString('es-AR')} • {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                        </p>
                      </div>
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No tenés reservas activas</p>
            )}
          </div>
        </div>
      </main>

      {/* Booking Modal */}
      {showModal && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Confirmar Reserva</h2>
            <div className="space-y-3 mb-4">
              <p>
                <span className="font-medium">Cancha:</span>{' '}
                {courts.find(c => c.id === selectedCourt)?.name}
              </p>
              <p>
                <span className="font-medium">Fecha:</span>{' '}
                {new Date(selectedDate).toLocaleDateString('es-AR')}
              </p>
              <p>
                <span className="font-medium">Horario:</span>{' '}
                {selectedSlot.start} - {selectedSlot.end}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Ej: Juego con Pedro y Juan"
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={createBooking}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
