import { ITerritoryTeamUnit } from './ITerritoryTeamUnit';
export interface ITerritoryTeam {
    territory?: string;
    name: string;    
    units: ITerritoryTeamUnit[]
}