import { ITerritoryTeam } from './ITerritoryTeam';
export interface ITwConfig {
    excludedPlayers: string[];
    teams: ITerritoryTeam[]; //teams allocated to a territory
    pool: ITerritoryTeam[]; //Pool of teams users can allocate to a territory
    defensiveSlots: number;
    minimumGearRequirement: number;
}