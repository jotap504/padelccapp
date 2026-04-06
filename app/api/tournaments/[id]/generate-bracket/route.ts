import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { id: tournamentId } = await params

  try {
    // Get tournament info
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
    }

    // Get confirmed registrations
    const { data: registrations } = await supabase
      .from('tournament_registrations')
      .select('*, user:users!user_id(id, name), partner:users!partner_id(id, name)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'confirmed')
      .order('seed', { ascending: true })
      .order('registration_date', { ascending: true })

    if (!registrations || registrations.length < 2) {
      return NextResponse.json({ error: 'Se necesitan al menos 2 participantes' }, { status: 400 })
    }

    const numParticipants = registrations.length
    const rounds = Math.ceil(Math.log2(numParticipants))
    const totalSlots = Math.pow(2, rounds)

    // Generate bracket matches
    const matches = []
    
    // Create all rounds
    for (let round = 1; round <= rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round)
      
      for (let i = 1; i <= matchesInRound; i++) {
        const position = `R${round}-M${i}`
        const isBye = round === 1 && i > numParticipants - matchesInRound
        
        matches.push({
          tournament_id: tournamentId,
          round: round,
          match_number: i,
          bracket_position: position,
          status: isBye ? 'bye' : 'pending'
        })
      }
    }

    // Insert matches
    const { data: createdMatches, error: matchesError } = await supabase
      .from('tournament_matches')
      .insert(matches)
      .select()

    if (matchesError) throw matchesError

    // Assign teams to first round matches
    const firstRoundMatches = createdMatches?.filter(m => m.round === 1 && m.status !== 'bye') || []
    
    for (let i = 0; i < firstRoundMatches.length && i * 2 < registrations.length; i++) {
      const match = firstRoundMatches[i]
      const regA = registrations[i * 2]
      const regB = registrations[i * 2 + 1]
      
      const teamA = [{ user_id: regA.user.id, name: regA.user.name }]
      if (regA.partner) {
        teamA.push({ user_id: regA.partner.id, name: regA.partner.name })
      }
      
      let teamB = null
      if (regB) {
        teamB = [{ user_id: regB.user.id, name: regB.user.name }]
        if (regB.partner) {
          teamB.push({ user_id: regB.partner.id, name: regB.partner.name })
        }
      }
      
      await supabase
        .from('tournament_matches')
        .update({ team_a: teamA, team_b: teamB })
        .eq('id', match.id)
    }

    // Update tournament status
    await supabase
      .from('tournaments')
      .update({ status: 'in_progress' })
      .eq('id', tournamentId)

    return NextResponse.json({ success: true, matches: createdMatches })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
