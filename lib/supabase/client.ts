import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
})

// Helper para setear el club_id en el contexto de la sesión
export async function setClubContext(clubId: string) {
  await supabase.rpc('set_claim', { claim: 'club_id', value: clubId })
}

// Helper para login dual (UUID o número de socio)
export async function loginWithIdentifier(clubSlug: string, identifier: string, password: string) {
  // Primero obtener el club_id desde el slug
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('slug', clubSlug)
    .single()
  
  if (!club) throw new Error('Club no encontrado')
  
  // Buscar usuario por número de socio o UUID
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('club_id', club.id)
    .or(`member_number.eq.${identifier},id.eq.${identifier}`)
    .single()
  
  if (!user) throw new Error('Usuario no encontrado')
  
  // Verificar contraseña (bcrypt)
  const bcrypt = await import('bcryptjs')
  const isValid = await bcrypt.compare(password, user.password_hash)
  
  if (!isValid) throw new Error('Contraseña incorrecta')
  
  // Crear sesión manual (usando JWT custom)
  const session = {
    user: {
      id: user.id,
      email: user.email,
      club_id: club.id,
      club_slug: clubSlug,
      role: 'player', // o 'admin' si corresponde
    },
    expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
  }
  
  return { user, session }
}
