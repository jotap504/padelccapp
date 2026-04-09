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

async function recalculateRanking() {
  // Fetch point configs for all clubs
  const { data: configs, error: configsError } = await supabase
    .from('club_point_configs')
    .select('*');
  
  if (configsError) {
    console.error('Error fetching configs:', configsError);
    return;
  }
  
  const clubConfigs = {};
  configs.forEach(c => clubConfigs[c.club_id] = c);
  
  // Fetch confirmed matches
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'confirmed');
  
  if (matchesError) {
    console.error('Error fetching matches:', matchesError);
    return;
  }
  
  // Fetch all players
  const { data: players, error: playersError } = await supabase
    .from('users')
    .select('id, name, category, club_id');
  
  if (playersError) {
    console.error('Error fetching players:', playersError);
    return;
  }
  
  const playerMap = {};
  players.forEach(p => playerMap[p.id] = p);
  
  // Initialize stats
  const playerStats = {};
  players.forEach(p => {
    playerStats[p.id] = {
      id: p.id,
      name: p.name,
      category: p.category,
      total_matches: 0,
      wins: 0,
      losses: 0,
      games_won: 0,
      games_lost: 0,
      rating_change: 0
    };
  });
  
  // Process matches
  matches.forEach(match => {
    const config = clubConfigs[match.club_id] || {
      base_rating: 1500,
      points_per_win: 20,
      points_per_loss: 20,
      points_per_game_diff: 0.5,
      category_bonus_percent: 20,
      category_penalty_percent: 5,
      max_points_per_match: 50,
      min_rating: 1000
    };
    
    const teamA = match.team_a || [];
    const teamB = match.team_b || [];
    const sets = match.sets || [];
    
    let gamesA = 0, gamesB = 0;
    let setsA = 0, setsB = 0;
    
    sets.forEach(set => {
      gamesA += set.games_a || 0;
      gamesB += set.games_b || 0;
      if (set.games_a > set.games_b) setsA++;
      else if (set.games_b > set.games_a) setsB++;
    });
    
    const teamAWon = setsA > setsB;
    
    // Calculate average category for each team
    const avgCat = (team) => {
      const cats = team.map(p => playerMap[p.user_id]?.category).filter(c => c != null);
      return cats.length ? cats.reduce((a,b) => a+b, 0) / cats.length : 5;
    };
    
    const catA = avgCat(teamA);
    const catB = avgCat(teamB);
    const catDiff = catB - catA; // Positive = B is stronger
    
    const gameDiff = Math.abs(gamesA - gamesB);
    const gamePoints = gameDiff * config.points_per_game_diff;
    
    // Calculate points for each team
    let pointsA, pointsB;
    
    if (teamAWon) {
      // Team A won
      pointsA = config.points_per_win + gamePoints;
      pointsB = -config.points_per_loss - gamePoints;
      
      // Bonus for A beating stronger team
      if (catDiff < 0) {
        const bonus = Math.abs(catDiff) * config.category_bonus_percent / 100 * pointsA;
        pointsA += bonus;
      }
      
      // Penalty for B losing to weaker team
      if (catDiff < 0) {
        const penalty = Math.abs(catDiff) * config.category_penalty_percent / 100 * Math.abs(pointsB);
        pointsB -= penalty;
      }
    } else {
      // Team B won
      pointsA = -config.points_per_loss - gamePoints;
      pointsB = config.points_per_win + gamePoints;
      
      // Bonus for B beating stronger team
      if (catDiff > 0) {
        const bonus = catDiff * config.category_bonus_percent / 100 * pointsB;
        pointsB += bonus;
      }
      
      // Penalty for A losing to weaker team
      if (catDiff > 0) {
        const penalty = catDiff * config.category_penalty_percent / 100 * Math.abs(pointsA);
        pointsA -= penalty;
      }
    }
    
    // Apply limits
    pointsA = Math.max(-config.max_points_per_match, Math.min(config.max_points_per_match, pointsA));
    pointsB = Math.max(-config.max_points_per_match, Math.min(config.max_points_per_match, pointsB));
    
    // Update player stats
    teamA.forEach(p => {
      const id = p.user_id;
      if (playerStats[id]) {
        playerStats[id].total_matches++;
        playerStats[id].games_won += gamesA;
        playerStats[id].games_lost += gamesB;
        if (teamAWon) playerStats[id].wins++;
        else playerStats[id].losses++;
        playerStats[id].rating_change += pointsA;
      }
    });
    
    teamB.forEach(p => {
      const id = p.user_id;
      if (playerStats[id]) {
        playerStats[id].total_matches++;
        playerStats[id].games_won += gamesB;
        playerStats[id].games_lost += gamesA;
        if (!teamAWon) playerStats[id].wins++;
        else playerStats[id].losses++;
        playerStats[id].rating_change += pointsB;
      }
    });
  });
  
  // Update players in database
  console.log('\n=== Player Rankings ===');
  
  for (const id in playerStats) {
    const stats = playerStats[id];
    if (stats.total_matches === 0) continue;
    
    const player = playerMap[id];
    const config = clubConfigs[player?.club_id] || { base_rating: 0, min_rating: 0, max_rating: 500 };
    
    const winRate = Math.round((stats.wins / stats.total_matches) * 100);
    let rating = config.base_rating + stats.rating_change;
    rating = Math.max(config.min_rating || 0, Math.min(config.max_rating || 500, Math.round(rating)));
    
    console.log(`${stats.name} (Cat ${stats.category}): ${stats.wins}W/${stats.losses}L | Rating: ${rating} (${stats.rating_change > 0 ? '+' : ''}${stats.rating_change.toFixed(1)})`);
    
    await supabase.from('users').update({
      total_matches: stats.total_matches,
      win_rate: winRate,
      rating: rating
    }).eq('id', id);
  }
  
  console.log('\n✅ Ranking recalculated!');
}

recalculateRanking().catch(console.error);
