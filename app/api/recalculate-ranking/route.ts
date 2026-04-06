import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST() {
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    // Fetch configs
    const { data: configs } = await supabase.from('club_point_configs').select('*')
    const clubConfigs: Record<string, any> = {}
    configs?.forEach((c: any) => clubConfigs[c.club_id] = c)
    
    // Fetch matches
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'confirmed')
    
    // Fetch players
    const { data: players } = await supabase
      .from('users')
      .select('id, name, category, club_id')
    
    const playerMap: Record<string, any> = {}
    players?.forEach((p: any) => playerMap[p.id] = p)
    
    // Initialize stats
    const playerStats: Record<string, any> = {}
    players?.forEach((p: any) => {
      playerStats[p.id] = {
        id: p.id, name: p.name, category: p.category,
        total_matches: 0, wins: 0, losses: 0,
        games_won: 0, games_lost: 0, rating_change: 0
      }
    })
    
    // Process matches
    matches?.forEach((match: any) => {
      const config = clubConfigs[match.club_id] || {
        base_rating: 1500, points_per_win: 20, points_per_loss: 20,
        points_per_game_diff: 0.5, category_bonus_percent: 20,
        category_penalty_percent: 5, max_points_per_match: 50, min_rating: 1000
      }
      
      const teamA = match.team_a || []
      const teamB = match.team_b || []
      const sets = match.sets || []
      
      let gamesA = 0, gamesB = 0, setsA = 0, setsB = 0
      sets.forEach((set: any) => {
        gamesA += set.games_a || 0
        gamesB += set.games_b || 0
        if (set.games_a > set.games_b) setsA++
        else if (set.games_b > set.games_a) setsB++
      })
      
      const teamAWon = setsA > setsB
      
      const avgCat = (team: any[]) => {
        const cats = team.map((p: any) => playerMap[p.user_id]?.category).filter((c: number) => c != null)
        return cats.length ? cats.reduce((a: number, b: number) => a + b, 0) / cats.length : 5
      }
      
      const catA = avgCat(teamA)
      const catB = avgCat(teamB)
      const catDiff = catB - catA
      
      const gameDiff = Math.abs(gamesA - gamesB)
      const gamePoints = gameDiff * config.points_per_game_diff
      
      let pointsA: number, pointsB: number
      
      if (teamAWon) {
        pointsA = config.points_per_win + gamePoints
        pointsB = -config.points_per_loss - gamePoints
        
        if (catDiff < 0) {
          const bonus = Math.abs(catDiff) * config.category_bonus_percent / 100 * pointsA
          pointsA += bonus
        }
        if (catDiff < 0) {
          const penalty = Math.abs(catDiff) * config.category_penalty_percent / 100 * Math.abs(pointsB)
          pointsB -= penalty
        }
      } else {
        pointsA = -config.points_per_loss - gamePoints
        pointsB = config.points_per_win + gamePoints
        
        if (catDiff > 0) {
          const bonus = catDiff * config.category_bonus_percent / 100 * pointsB
          pointsB += bonus
        }
        if (catDiff > 0) {
          const penalty = catDiff * config.category_penalty_percent / 100 * Math.abs(pointsA)
          pointsA -= penalty
        }
      }
      
      pointsA = Math.max(-config.max_points_per_match, Math.min(config.max_points_per_match, pointsA))
      pointsB = Math.max(-config.max_points_per_match, Math.min(config.max_points_per_match, pointsB))
      
      teamA.forEach((p: any) => {
        const id = p.user_id
        if (playerStats[id]) {
          playerStats[id].total_matches++
          playerStats[id].games_won += gamesA
          playerStats[id].games_lost += gamesB
          if (teamAWon) playerStats[id].wins++
          else playerStats[id].losses++
          playerStats[id].rating_change += pointsA
        }
      })
      
      teamB.forEach((p: any) => {
        const id = p.user_id
        if (playerStats[id]) {
          playerStats[id].total_matches++
          playerStats[id].games_won += gamesB
          playerStats[id].games_lost += gamesA
          if (!teamAWon) playerStats[id].wins++
          else playerStats[id].losses++
          playerStats[id].rating_change += pointsB
        }
      })
    })
    
    // Update players
    for (const id in playerStats) {
      const stats = playerStats[id]
      if (stats.total_matches === 0) continue
      
      const player = playerMap[id]
      const config = clubConfigs[player?.club_id] || { base_rating: 1500, min_rating: 1000 }
      
      const winRate = Math.round((stats.wins / stats.total_matches) * 100)
      let rating = config.base_rating + stats.rating_change
      rating = Math.max(config.min_rating, Math.round(rating))
      
      await supabase.from('users').update({
        total_matches: stats.total_matches,
        win_rate: winRate,
        rating: rating
      }).eq('id', id)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
