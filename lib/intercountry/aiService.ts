// AI Service for Intercountry Tournament Team Suggestions

export interface Player {
  id: string
  name: string
  member_number: string
  category: number
  rating: number
  availability: { day: string, available: boolean }[]
  recent_form: { matches: number, wins: number, avg_score: number }
  chemistry: { partner_id: string, score: number }[]
}

export interface TeamSuggestion {
  id: string
  round: number
  opponent_id: string
  opponent_name: string
  suggested_team: Player[]
  confidence_score: number
  reasoning: string[]
  alternatives: Player[][]
  factors_used: {
    ranking_weight: number
    availability_weight: number
    chemistry_weight: number
    recent_form_weight: number
  }
}

export interface AIConfig {
  ranking_weight: number
  availability_weight: number
  chemistry_weight: number
  recent_form_weight: number
  min_chemistry_score: number
  max_players_per_match: number
}

class AIService {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /**
   * Generate team suggestions for a specific match
   */
  async generateTeamSuggestion(
    tournamentId: string,
    clubId: string,
    opponentId: string,
    round: number,
    players: Player[]
  ): Promise<TeamSuggestion> {
    try {
      // Get AI configuration
      const { data: config, error: configError } = await this.supabase
        .from('intercountry_ai_config')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single()

      if (configError || !config) {
        // Use default configuration
        const defaultConfig: AIConfig = {
          ranking_weight: 0.4,
          availability_weight: 0.3,
          chemistry_weight: 0.2,
          recent_form_weight: 0.1,
          min_chemistry_score: 6.0,
          max_players_per_match: 4
        }
        return this.calculateSuggestion(
          tournamentId,
          clubId,
          opponentId,
          round,
          players,
          defaultConfig
        )
      }

      return this.calculateSuggestion(
        tournamentId,
        clubId,
        opponentId,
        round,
        players,
        config
      )
    } catch (error) {
      console.error('Error generating AI suggestion:', error)
      throw error
    }
  }

  /**
   * Calculate team suggestion using AI algorithm
   */
  private async calculateSuggestion(
    tournamentId: string,
    clubId: string,
    opponentId: string,
    round: number,
    players: Player[],
    config: AIConfig
  ): Promise<TeamSuggestion> {
    // Filter available players (assuming Sunday matches)
    const availablePlayers = players.filter(player => 
      player.availability.some(a => a.day === 'sunday' && a.available)
    )

    if (availablePlayers.length < config.max_players_per_match) {
      throw new Error('No hay suficientes jugadores disponibles para este partido')
    }

    // Calculate scores for all possible combinations
    const combinations = this.generateCombinations(
      availablePlayers,
      config.max_players_per_match
    )

    let bestCombination: Player[] = []
    let bestScore = 0
    let bestReasoning: string[] = []

    for (const combination of combinations) {
      const { score, reasoning } = this.calculateTeamScore(combination, config)
      
      if (score > bestScore) {
        bestScore = score
        bestCombination = combination
        bestReasoning = reasoning
      }
    }

    // Generate alternatives
    const alternatives = combinations
      .map(c => ({ team: c, score: this.calculateTeamScore(c, config).score }))
      .sort((a, b) => b.score - a.score)
      .slice(1, 4) // Top 3 alternatives
      .map(c => c.team)

    // Save suggestion to database
    const suggestionData = {
      tournament_id: tournamentId,
      club_id: clubId,
      round: round,
      opponent_id: opponentId,
      suggested_team: bestCombination.map(p => ({
        player_id: p.id,
        confidence_score: this.calculateIndividualScore(p, config),
        reasoning: this.getPlayerReasoning(p)
      })),
      alternative_teams: alternatives.map(alt => 
        alt.map(p => ({
          player_id: p.id,
          confidence_score: this.calculateIndividualScore(p, config)
        }))
      ),
      factors_used: config
    }

    await this.supabase
      .from('intercountry_ai_suggestions')
      .insert(suggestionData)

    return {
      id: crypto.randomUUID(),
      round,
      opponent_id: opponentId,
      opponent_name: 'Opponent Team', // TODO: Get actual name
      suggested_team: bestCombination,
      confidence_score: bestScore,
      reasoning: bestReasoning,
      alternatives,
      factors_used: config
    }
  }

  /**
   * Generate all possible combinations of players
   */
  private generateCombinations(players: Player[], teamSize: number): Player[][] {
    const combinations: Player[][] = []
    
    const combine = (start: number, current: Player[]) => {
      if (current.length === teamSize) {
        combinations.push([...current])
        return
      }
      
      for (let i = start; i < players.length; i++) {
        current.push(players[i])
        combine(i + 1, current)
        current.pop()
      }
    }
    
    combine(0, [])
    return combinations
  }

  /**
   * Calculate team score based on multiple factors
   */
  private calculateTeamScore(team: Player[], config: AIConfig): { score: number, reasoning: string[] } {
    const reasoning: string[] = []
    let totalScore = 0

    // 1. Ranking Score (40% weight)
    const avgRating = team.reduce((sum, p) => sum + p.rating, 0) / team.length
    const rankingScore = avgRating / 10 * config.ranking_weight
    totalScore += rankingScore
    reasoning.push(`Rating promedio: ${avgRating.toFixed(1)}`)

    // 2. Chemistry Score (20% weight)
    let totalChemistry = 0
    let chemistryCount = 0
    
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const chemistry = this.getChemistryScore(team[i], team[j])
        totalChemistry += chemistry
        chemistryCount++
      }
    }
    
    const avgChemistry = chemistryCount > 0 ? totalChemistry / chemistryCount : 5
    const chemistryScore = avgChemistry / 10 * config.chemistry_weight
    totalScore += chemistryScore
    
    if (avgChemistry >= config.min_chemistry_score) {
      reasoning.push(`Buena química de equipo: ${avgChemistry.toFixed(1)}`)
    } else {
      reasoning.push(`Química mejorable: ${avgChemistry.toFixed(1)}`)
    }

    // 3. Recent Form (10% weight)
    const avgForm = team.reduce((sum, p) => {
      const winRate = p.recent_form.matches > 0 
        ? p.recent_form.wins / p.recent_form.matches 
        : 0
      return sum + winRate
    }, 0) / team.length
    
    const formScore = avgForm * config.recent_form_weight
    totalScore += formScore
    reasoning.push(`Forma reciente: ${(avgForm * 100).toFixed(0)}% victorias`)

    // 4. Availability (30% weight)
    const availabilityScore = config.availability_weight // Assuming all available
    totalScore += availabilityScore
    reasoning.push('Todos los jugadores disponibles')

    // Category balance bonus
    const categories = team.map(p => p.category)
    const categorySpread = Math.max(...categories) - Math.min(...categories)
    if (categorySpread <= 2) {
      totalScore += 0.05
      reasoning.push('Buena balance de categorías')
    }

    return {
      score: Math.min(1, totalScore),
      reasoning
    }
  }

  /**
   * Calculate individual player score
   */
  private calculateIndividualScore(player: Player, config: AIConfig): number {
    const ratingScore = (player.rating / 10) * config.ranking_weight
    const availabilityScore = config.availability_weight
    const formScore = (player.recent_form.matches > 0 
      ? player.recent_form.wins / player.recent_form.matches 
      : 0.5) * config.recent_form_weight
    
    return Math.min(1, ratingScore + availabilityScore + formScore)
  }

  /**
   * Get chemistry score between two players
   */
  private getChemistryScore(player1: Player, player2: Player): number {
    const chemistry = player1.chemistry.find(c => c.partner_id === player2.id)
    return chemistry ? chemistry.score : 5.0 // Default chemistry
  }

  /**
   * Get reasoning for individual player selection
   */
  private getPlayerReasoning(player: Player): string[] {
    const reasoning: string[] = []
    
    if (player.rating >= 8) {
      reasoning.push('Alto rating')
    }
    
    if (player.recent_form.matches > 0) {
      const winRate = player.recent_form.wins / player.recent_form.matches
      if (winRate >= 0.7) {
        reasoning.push('Excelente forma reciente')
      } else if (winRate >= 0.5) {
        reasoning.push('Buena forma reciente')
      }
    }
    
    if (player.category >= 5) {
      reasoning.push('Categoría alta')
    }
    
    return reasoning
  }

  /**
   * Get existing suggestions for a tournament and club
   */
  async getExistingSuggestions(
    tournamentId: string,
    clubId: string
  ): Promise<TeamSuggestion[]> {
    try {
      const { data, error } = await this.supabase
        .from('intercountry_ai_suggestions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('club_id', clubId)
        .order('round', { ascending: true })

      if (error) throw error

      // Transform data to match interface
      return data.map((s: any) => ({
        id: s.id,
        round: s.round,
        opponent_id: s.opponent_id,
        opponent_name: 'Opponent Team', // TODO: Join with clubs table
        suggested_team: [], // TODO: Transform suggested_team JSONB
        confidence_score: 0.8, // TODO: Calculate from factors
        reasoning: [], // TODO: Extract from factors_used
        alternatives: [], // TODO: Transform alternative_teams JSONB
        factors_used: s.factors_used
      }))
    } catch (error) {
      console.error('Error getting existing suggestions:', error)
      return []
    }
  }

  /**
   * Update AI configuration for tournament
   */
  async updateAIConfig(
    tournamentId: string,
    config: Partial<AIConfig>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('intercountry_ai_config')
        .upsert({
          tournament_id: tournamentId,
          ...config
        })

      if (error) throw error
    } catch (error) {
      console.error('Error updating AI config:', error)
      throw error
    }
  }
}

export default AIService
