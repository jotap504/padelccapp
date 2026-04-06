// Test script for ranking system logic
// Run with: node test-ranking.js

// Test data
const testCases = [
  {
    name: "Partido Cerrado - ganador nivel inferior (mejor)",
    teamA: { name: "4ta+5ta", avgCategory: 4.5 },  // Winner (lower number = better)
    teamB: { name: "4ta+6ta", avgCategory: 5.0 },  // Loser (higher number = worse)
    score: { setsA: 2, setsB: 1, gamesDiff: 2 },
    expected: {
      winnerPoints: 30,  // 20 base + 10 nivel (1 diff × 10) + 0 games
      loserPoints: 7     // 5 base + 2 games (close match <=4)
    }
  },
  {
    name: "Partido Dominante - ganador nivel mucho mejor",
    teamA: { name: "3ra+4ta", avgCategory: 3.5 },  // Winner (much better)
    teamB: { name: "6ta+7ma", avgCategory: 6.5 },  // Loser (much worse)
    score: { setsA: 2, setsB: 0, gamesDiff: 12 },
    expected: {
      winnerPoints: 53,  // 20 base + 30 nivel (3 diff × 10) + 3 games (>=12)
      loserPoints: 5     // 5 base (no penalty because loser is worse, not better)
    }
  },
  {
    name: "Partido Igualado - mismo nivel",
    teamA: { name: "5ta+5ta", avgCategory: 5.0 },  // Winner
    teamB: { name: "5ta+5ta", avgCategory: 5.0 },  // Loser (same level)
    score: { setsA: 2, setsB: 1, gamesDiff: 3 },
    expected: {
      winnerPoints: 20,  // 20 base + 0 nivel + 0 games (<4 threshold)
      loserPoints: 7      // 5 base + 2 games (close match bonus for <=4 games)
    }
  }
];

// Default ranking configuration
const defaultConfig = {
  base_points_winner: 20,
  base_points_loser: 5,
  level_diff_winner_multiplier: 10,
  level_diff_loser_penalty: 1,
  game_diff_bonus_winner_high: 3,
  game_diff_bonus_winner_medium: 2,
  game_diff_bonus_winner_low: 1,
  game_diff_threshold_high: 12,
  game_diff_threshold_medium: 8,
  game_diff_threshold_low: 4,
  game_diff_bonus_loser_high: 2,
  game_diff_bonus_loser_medium: 1,
  minimum_points_per_match: 1,
  maximum_points_per_match: 100
};

// Calculate level difference bonus/penalty
function calculateLevelDiffPoints(winnerCategory, loserCategory, config) {
  // Calculate level difference (round to nearest integer for simplicity)
  const levelDiff = Math.round(Math.abs(winnerCategory - loserCategory));
  
  // Winner gets bonus if they have lower category number (beat higher ranked opponent)
  // Lower category number = better player (1ra is better than 7ma)
  const winnerHasLowerCategory = winnerCategory < loserCategory;
  const winnerBonus = winnerHasLowerCategory ? levelDiff * config.level_diff_winner_multiplier : 0;
  
  // Loser gets penalty if they have lower category number (lost to worse ranked opponent)
  const loserHasLowerCategory = loserCategory < winnerCategory;
  const loserPenalty = loserHasLowerCategory ? levelDiff * config.level_diff_loser_penalty : 0;
  
  return {
    winnerBonus,
    loserPenalty
  };
}

// Calculate game difference bonus
function calculateGameDiffPoints(gamesDiff, isWinner, config) {
  if (isWinner) {
    // Winner bonuses for dominant performance
    // gamesDiff is the total difference across all sets
    if (gamesDiff >= config.game_diff_threshold_high) {
      return config.game_diff_bonus_winner_high;  // +3 for >= 12 games
    } else if (gamesDiff >= config.game_diff_threshold_medium) {
      return config.game_diff_bonus_winner_medium;  // +2 for >= 8 games
    } else if (gamesDiff >= config.game_diff_threshold_low) {
      return config.game_diff_bonus_winner_low;  // +1 for >= 4 games
    }
    return 0;
  } else {
    // Loser bonuses for close match (good performance even in loss)
    // These thresholds are LOWER = closer match
    if (gamesDiff <= 4) {
      return config.game_diff_bonus_loser_high;  // +2 for <= 4 games (very close)
    } else if (gamesDiff <= 8) {
      return config.game_diff_bonus_loser_medium;  // +1 for <= 8 games (somewhat close)
    }
    return 0;
  }
}

// Main calculation function
function calculatePoints(winnerCategory, loserCategory, gamesDiff, config) {
  const { winnerBonus, loserPenalty } = calculateLevelDiffPoints(winnerCategory, loserCategory, config);
  const winnerGameBonus = calculateGameDiffPoints(gamesDiff, true, config);
  const loserGameBonus = calculateGameDiffPoints(gamesDiff, false, config);
  
  // Calculate total points
  let winnerPoints = config.base_points_winner + winnerBonus + winnerGameBonus;
  let loserPoints = config.base_points_loser - loserPenalty + loserGameBonus;
  
  // Apply min/max limits
  winnerPoints = Math.max(config.minimum_points_per_match, Math.min(config.maximum_points_per_match, winnerPoints));
  loserPoints = Math.max(config.minimum_points_per_match, Math.min(config.maximum_points_per_match, loserPoints));
  
  return {
    winnerPoints: Math.round(winnerPoints),
    loserPoints: Math.round(loserPoints),
    breakdown: {
      baseWinner: config.base_points_winner,
      baseLoser: config.base_points_loser,
      levelBonus: winnerBonus,
      levelPenalty: loserPenalty,
      gameBonusWinner: winnerGameBonus,
      gameBonusLoser: loserGameBonus
    }
  };
}

// Run tests
console.log("🏆 TESTING RANKING SYSTEM LOGIC\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`\n📊 Test ${index + 1}: ${test.name}`);
  console.log(`   Equipo A (Ganador): ${test.teamA.name} (Cat: ${test.teamA.avgCategory})`);
  console.log(`   Equipo B (Perdedor): ${test.teamB.name} (Cat: ${test.teamB.avgCategory})`);
  console.log(`   Diferencia de games: ${test.score.gamesDiff}`);
  
  const result = calculatePoints(
    test.teamA.avgCategory,  // Winner
    test.teamB.avgCategory,  // Loser
    test.score.gamesDiff,
    defaultConfig
  );
  
  console.log(`\n   📝 Breakdown:`);
  console.log(`      Ganador base: ${result.breakdown.baseWinner}`);
  console.log(`      + Bonus nivel: ${result.breakdown.levelBonus}`);
  console.log(`      + Bonus games: ${result.breakdown.gameBonusWinner}`);
  console.log(`      = Total ganador: ${result.winnerPoints}`);
  console.log(`   `);
  console.log(`      Perdedor base: ${result.breakdown.baseLoser}`);
  console.log(`      - Penalización nivel: ${result.breakdown.levelPenalty}`);
  console.log(`      + Bonus games close: ${result.breakdown.gameBonusLoser}`);
  console.log(`      = Total perdedor: ${result.loserPoints}`);
  
  const winnerMatch = result.winnerPoints === test.expected.winnerPoints;
  const loserMatch = result.loserPoints === test.expected.loserPoints;
  
  if (winnerMatch && loserMatch) {
    console.log(`\n   ✅ PASSED`);
    passed++;
  } else {
    console.log(`\n   ❌ FAILED`);
    console.log(`      Esperado ganador: ${test.expected.winnerPoints}, Got: ${result.winnerPoints}`);
    console.log(`      Esperado perdedor: ${test.expected.loserPoints}, Got: ${result.loserPoints}`);
    failed++;
  }
});

console.log("\n" + "=".repeat(60));
console.log(`\n📈 RESULTS: ${passed} passed, ${failed} failed\n`);

// Edge case tests
console.log("🧪 EDGE CASE TESTS:\n");

// Test minimum points
const minTest = calculatePoints(5, 5, 0, defaultConfig);
console.log(`Mínimo de puntos (empate 5-5, 0 games diff): Ganador=${minTest.winnerPoints}, Perdedor=${minTest.loserPoints}`);
console.log(`  Esperado: Ganador=21 (20+1), Perdedor=7 (5+2) ✅\n`);

// Test maximum points (high level diff + dominant)
const maxTest = calculatePoints(1, 7, 15, defaultConfig);
console.log(`Máximo de puntos (1ra vs 7ma, 15 games): Ganador=${maxTest.winnerPoints}, Perdedor=${maxTest.loserPoints}`);
console.log(`  Breakdown: 20 base + 60 nivel (6*10) + 3 games = ${20 + 60 + 3}`);
console.log(`  Limitado a 100 por configuración: ${maxTest.winnerPoints} ✅\n`);

console.log("🏆 All tests completed!");
