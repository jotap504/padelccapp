const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim().replace(/['"]/g, '');
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function setupAndRecalculate() {
  console.log('Creating point config table...');
  
  // Create table if not exists
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS club_point_configs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        base_rating INTEGER DEFAULT 1500,
        points_per_win INTEGER DEFAULT 20,
        points_per_loss INTEGER DEFAULT 20,
        points_per_game_diff DECIMAL(4,2) DEFAULT 0.5,
        category_bonus_percent DECIMAL(5,2) DEFAULT 20.00,
        category_penalty_percent DECIMAL(5,2) DEFAULT 5.00,
        max_points_per_match INTEGER DEFAULT 50,
        min_rating INTEGER DEFAULT 1000,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(club_id)
      );
    `
  });
  
  if (createError) {
    console.log('Table may already exist or using alternative method...');
  }
  
  // Insert default config for existing club
  const { data: clubs } = await supabase.from('clubs').select('id').limit(1);
  if (clubs && clubs.length > 0) {
    const clubId = clubs[0].id;
    await supabase.from('club_point_configs').upsert({
      club_id: clubId,
      base_rating: 1500,
      points_per_win: 20,
      points_per_loss: 20,
      points_per_game_diff: 0.5,
      category_bonus_percent: 20,
      category_penalty_percent: 5,
      max_points_per_match: 50,
      min_rating: 1000
    });
    console.log('Default config created for club:', clubId);
  }
  
  // Now recalculate
  console.log('\nRecalculating ranking with new rules...');
  
  // Fetch configs
  const { data: configs } = await supabase.from('club_point_configs').select('*');
  const clubConfigs = {};
  configs?.forEach(c => clubConfigs[c.club_id] = c);
  
  // Fetch matches
  const { data: matches } = await supabase.from('matches').select('*').eq('status', 'confirmed');
  console.log(`Found ${matches?.length || 0} confirmed matches`);
  
  // Fetch players
  const { data: players } = await supabase.from('users').select('id, name, category, club_id');
  console.log(`Found ${players?.length || 0} players`);
  
  const playerMap = {};
  players?.forEach(p => playerMap[p.id] = p);
  
  // Initialize stats
  const playerStats = {};
  players?.forEach(p => {
    playerStats[p.id] = {
      id: p.id, name: p.name, category: p.category,
      total_matches: 0, wins: 0, losses: 0,
      games_won: 0, games_lost: 0, rating_change: 0
    };
  });
  
  // Process matches
  matches?.forEach(match => {
    const config = clubConfigs[match.club_id] || {
      base_rating: 1500, points_per_win: 20, points_per_loss: 20,
      points_per_game_diff: 0.5, category_bonus_percent: 20,
      category_penalty_percent: 5, max_points_per_match: 50, min_rating: 1000
    };
    
    const teamA = match.team_a || [];
    const teamB = match.team_b || [];
    const sets = match.sets || [];
    
    let gamesA = 0, gamesB = 0, setsA = 0, setsB = 0;
    sets.forEach(set => {
      gamesA += set.games_a || 0;
      gamesB += set.games_b || 0;
      if (set.games_a > set.games_b) setsA++;
      else if (set.games_b > set.games_a) setsB++;
    });
    
    const teamAWon = setsA > setsB;
    
    const avgCat = (team) => {
      const cats = team.map(p => playerMap[p.user_id]?.category).filter(c => c != null);
      return cats.length ? cats.reduce((a,b) => a+b, 0) / cats.length : 5;
    };
    
    const catA = avgCat(teamA);
    const catB = avgCat(teamB);
    const catDiff = catB - catA;
    
    const gameDiff = Math.abs(gamesA - gamesB);
    const gamePoints = gameDiff * config.points_per_game_diff;
    
    let pointsA, pointsB;
    
    if (teamAWon) {
      pointsA = config.points_per_win + gamePoints;
      pointsB = -config.points_per_loss - gamePoints;
      
      if (catDiff < 0) {
        const bonus = Math.abs(catDiff) * config.category_bonus_percent / 100 * pointsA;
        pointsA += bonus;
      }
      if (catDiff < 0) {
        const penalty = Math.abs(catDiff) * config.category_penalty_percent / 100 * Math.abs(pointsB);
        pointsB -= penalty;
      }
    } else {
      pointsA = -config.points_per_loss - gamePoints;
      pointsB = config.points_per_win + gamePoints;
      
      if (catDiff > 0) {
        const bonus = catDiff * config.category_bonus_percent / 100 * pointsB;
        pointsB += bonus;
      }
      if (catDiff > 0) {
        const penalty = catDiff * config.category_penalty_percent / 100 * Math.abs(pointsA);
        pointsA -= penalty;
      }
    }
    
    pointsA = Math.max(-config.max_points_per_match, Math.min(config.max_points_per_match, pointsA));
    pointsB = Math.max(-config.max_points_per_match, Math.min(config.max_points_per_match, pointsB));
    
    teamA.forEach(p => {
      const id = p.user_id;
      if (playerStats[id]) {
        playerStats[id].total_matches++;
        playerStats[id].games_won += gamesA;
        playerStats[id].games_lost += gamesB;
        if (teamAWon) playerStats[id].wins++; else playerStats[id].losses++;
        playerStats[id].rating_change += pointsA;
      }
    });
    
    teamB.forEach(p => {
      const id = p.user_id;
      if (playerStats[id]) {
        playerStats[id].total_matches++;
        playerStats[id].games_won += gamesB;
        playerStats[id].games_lost += gamesA;
        if (!teamAWon) playerStats[id].wins++; else playerStats[id].losses++;
        playerStats[id].rating_change += pointsB;
      }
    });
  });
  
  // Update players
  console.log('\n=== Updated Rankings ===');
  
  for (const id in playerStats) {
    const stats = playerStats[id];
    if (stats.total_matches === 0) continue;
    
    const player = playerMap[id];
    const config = clubConfigs[player?.club_id] || { base_rating: 1500, min_rating: 1000 };
    
    const winRate = Math.round((stats.wins / stats.total_matches) * 100);
    let rating = config.base_rating + stats.rating_change;
    rating = Math.max(config.min_rating, Math.round(rating));
    
    // Show bonus/penalty details
    const changeStr = stats.rating_change > 0 ? `+${stats.rating_change.toFixed(1)}` : stats.rating_change.toFixed(1);
    console.log(`${stats.name} (Cat ${stats.category}): ${stats.wins}W/${stats.losses}L | Rating: ${rating} (${changeStr})`);
    
    await supabase.from('users').update({
      total_matches: stats.total_matches,
      win_rate: winRate,
      rating: rating
    }).eq('id', id);
  }
  
  console.log('\n✅ Ranking recalculated with category bonus/penalty!');
}

setupAndRecalculate().catch(console.error);
