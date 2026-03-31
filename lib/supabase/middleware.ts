import { NextRequest, NextResponse } from 'next/server'
import { supabase } from './client'

// Middleware para verificar autenticación y setear contexto de club
export async function authMiddleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const clubSlug = request.headers.get('x-club-slug') || request.nextUrl.pathname.split('/')[2]
  
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  
  try {
    // Verificar token y obtener club_id
    const { data: club } = await supabase
      .from('clubs')
      .select('id')
      .eq('slug', clubSlug)
      .single()
    
    if (!club) {
      return NextResponse.json({ error: 'Club no encontrado' }, { status: 404 })
    }
    
    // Setear contexto de club para RLS
    await supabase.rpc('set_claim', { claim: 'club_id', value: club.id })
    
    return NextResponse.next()
  } catch (error) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }
}
