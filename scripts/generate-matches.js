const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env from .env.local
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

function generateValidScore() {
  const scoreTypes = [
    [[6, 4], [6, 3]],
    [[6, 2], [6, 1]],
    [[6, 0], [6, 4]],
    [[7, 5], [6, 3]],
    [[6, 4], [4, 6], [6, 2]],
    [[3, 6], [6, 3], [6, 4]],
    [[6, 7], [6, 4], [6, 3]],
    [[6, 4], [6, 7], [7, 5]],
    [[7, 6], [6, 4]],
    [[6, 4], [7, 6]]
  ];
  return scoreTypes[Math.floor(Math.random() * scoreTypes.length)];
}

function createTeam(player1, player2) {
  return [
    { user_id: player1.id, side: 'drive', position: 'left' },
    { user_id: player2.id, side: 'backhand', position: 'right' }
  ];
}

async function createMatches() {
  // Fetch existing players and club
  const { data: players, error: playersError } = await supabase
    .from('users')
    .select('id, name, category');
  
  if (playersError) {
    console.error('Error fetching players:', playersError);
    return;
  }
  
  if (!players || players.length < 4) {
    console.error('Need at least 4 players, found:', players?.length);
    return;
  }
  
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id')
    .limit(1);
  
  if (clubsError || !clubs || clubs.length === 0) {
    console.error('Error fetching club:', clubsError);
    return;
  }
  
  const clubId = clubs[0].id;
  console.log(`Using club: ${clubId}`);
  console.log(`Players available: ${players.length}`);
  
  // Find the 6th category player (Pedro or Maria) to be the superstar
  const sixCatPlayers = players.filter(p => p.category === 6);
  console.log('6th category players:', sixCatPlayers.map(p => p.name));
  
  const SUPERSTAR = sixCatPlayers[0];
  if (!SUPERSTAR) {
    console.error('No 6th category player found');
    return;
  }
  console.log(`Superstar selected: ${SUPERSTAR.name} (Category ${SUPERSTAR.category})`);
  
  const createdBy = players[0].id;
  const createdMatches = [];
  
  for (let i = 0; i < 50; i++) {
    // Pick 4 random players
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const matchPlayers = shuffled.slice(0, 4);
    
    const teamA = [matchPlayers[0], matchPlayers[1]];
    const teamB = [matchPlayers[2], matchPlayers[3]];
    
    let score = generateValidScore();
    
    // Check if superstar is playing
    const superstarInTeamA = teamA.some(p => p.id === SUPERSTAR.id);
    const superstarInTeamB = teamB.some(p => p.id === SUPERSTAR.id);
    
    if (superstarInTeamA || superstarInTeamB) {
      const setsWonA = score.filter(s => s[0] > s[1]).length;
      const setsWonB = score.filter(s => s[1] > s[0]).length;
      
      if (superstarInTeamA && setsWonB > setsWonA) {
        score = score.map(s => [s[1], s[0]]);
      } else if (superstarInTeamB && setsWonA > setsWonB) {
        score = score.map(s => [s[1], s[0]]);
      } else if (setsWonA === setsWonB) {
        score = [[6, 4], [6, 3]];
        if (superstarInTeamB) {
          score = score.map(s => [s[1], s[0]]);
        }
      }
    }
    
    const setsData = score.map(s => ({ games_a: s[0], games_b: s[1] }));
    const gamesDiff = score.reduce((acc, s) => acc + (s[0] - s[1]), 0);
    
    const match = {
      club_id: clubId,
      created_by: createdBy,
      date: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString(),
      status: 'confirmed',
      team_a: createTeam(teamA[0], teamA[1]),
      team_b: createTeam(teamB[0], teamB[1]),
      sets: setsData,
      games_diff: gamesDiff,
      validated_by: [teamA[0].id, teamB[0].id]
    };
    
    createdMatches.push(match);
  }
  
  console.log(`\nCreating ${createdMatches.length} matches...`);
  
  let superstarMatches = 0;
  let successCount = 0;
  
  for (let i = 0; i < createdMatches.length; i++) {
    const match = createdMatches[i];
    const { data, error } = await supabase
      .from('matches')
      .insert(match)
      .select();
    
    if (error) {
      console.error(`Error creating match ${i + 1}:`, error.message);
    } else {
      successCount++;
      const superstarInMatch = 
        match.team_a.some(p => p.user_id === SUPERSTAR.id) ||
        match.team_b.some(p => p.user_id === SUPERSTAR.id);
      if (superstarInMatch) superstarMatches++;
      if (superstarInMatch) {
        console.log(`Match ${i + 1}/50 created ✓ (Superstar wins!)`);
      }
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total matches created: ${successCount}/50`);
  console.log(`Matches with ${SUPERSTAR.name} (Category ${SUPERSTAR.category}): ${superstarMatches}`);
  console.log(`Success rate: ${(successCount/50*100).toFixed(0)}%`);
  
  if (successCount === 50) {
    console.log('\n✅ All matches created successfully!');
    console.log(`${SUPERSTAR.name} (6th category) won all their matches,`);
    console.log('including matches against 4th category players!');
  }
}

createMatches().catch(console.error);
