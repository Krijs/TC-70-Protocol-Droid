import { IMatchedTeam } from "../interfaces/IMatchedTeam";
import { IGuild } from '../interfaces/swgoh.gg/guild/IGuild';
import { ITwConfig } from '../interfaces/ITwConfig';
import { ITerritoryTeam } from '../interfaces/ITerritoryTeam';
import { ITerritoryTeamUnit } from '../interfaces/ITerritoryTeamUnit';
import { IUnit } from "../interfaces/swgoh.gg/player/IUnit";
import { IPlayer } from "../interfaces/swgoh.gg/player/IPlayer";

export class TwTeamMatcher {
    constructor(private cfg : ITwConfig, private guild : IGuild) {}
    matchTeams(teamsForTerritory : ITerritoryTeam[]) : Map<string, IMatchedTeam[]> {
        let territoryTeams2 = new Map<string, IMatchedTeam[]>();                            
        for(let player of this.guild.players) { 
            //Skip excluded players                                
            if(this.cfg.excludedPlayers.some(ep => ep.toLowerCase() === player.data.name.toLowerCase())) continue;

            //Iterate the teams set in the territory(/ies)
            for(let poolTeam of teamsForTerritory) {
                //Get (and create if needed) territory
                if(!territoryTeams2.has(poolTeam.territory)) {
                    territoryTeams2.set(poolTeam.territory, []);
                }                                    
                let teams = territoryTeams2.get(poolTeam.territory); 

                //Iterate the units contained within each set team
                for(let poolUnit of poolTeam.units) {
                    let playerUnit = player.units.find(u => u.data.name.toLowerCase() === poolUnit.unitName.toLowerCase());
                    //Key component missing, therefore we are not able to create a match
                    if(playerUnit === undefined) {
                        if(this.breaksTeamComposition(poolUnit)) break;
                        continue; //The unit is either replaceable or a reserve, continue searching player units
                    }

                    //Check unit meets gear requirements
                    if(!this.hasRequiredGear(poolUnit, playerUnit)) {
                        //Unit failed on gear requirements - if we can't replace them then the player can't field the team.        
                        if(this.breaksTeamComposition(poolUnit)) break;
                        continue;
                    }

                    //Check unit has required zetas                                        
                    let zetaCheck = this.hasRequiredZetas(poolUnit, playerUnit);
                    if(!zetaCheck.success) {
                        if(zetaCheck.shouldBreak) break;
                        continue;
                    }

                    //Add unit to team!
                    let team = teams.find(t => t.teamName === poolTeam.name && t.playerName === player.data.name);
                    if(team === undefined) {
                        team = {
                            playerName: player.data.name,
                            teamName: poolTeam.name, 
                            allyCode: player.data.ally_code,                                               
                            teamMembers: [],
                            totalGp: 0,
                            territory: poolTeam.territory //I know we're putting teams under territories but this is needed elsewhere too.
                        };
                        teams.push(team);
                    }
            
                    team.teamMembers.push(playerUnit.data.name);
                    team.totalGp += playerUnit.data.power;

                    //Team size === 5, so break off after that to avoid building oversized teams...
                    if(team.teamMembers.length >= 5) break;
                }
            }          
        }
        return territoryTeams2;
    }

    private hasRequiredGear(poolUnit : ITerritoryTeamUnit, playerUnit : IUnit) : boolean {
        return (poolUnit.minimumGearTier !== undefined && playerUnit.data.gear_level < poolUnit.minimumGearTier)
        || (poolUnit.minimumGearTier === undefined && this.cfg.minimumGearRequirement !== undefined && 
            playerUnit.data.gear_level < this.cfg.minimumGearRequirement);
    }

    private hasRequiredZetas(poolUnit : ITerritoryTeamUnit, playerUnit : IUnit) : { success: boolean, shouldBreak: boolean } {
        let ret = { success: true, shouldBreak: false };

        if(poolUnit.zetasRequired !== undefined && poolUnit.zetasRequired.length > 0) {                                            
            for(let poolZeta of poolUnit.zetasRequired) {
                let zeta = playerUnit.data.ability_data.find(a => a.is_zeta && 
                    a.name.toLowerCase() === poolZeta.toLowerCase());

                //Key component missing, therefore we are not able to create a match
                if(zeta === undefined) {
                    ret.success = false;
                    ret.shouldBreak = this.breaksTeamComposition(poolUnit);
                    return ret;
                } 
                
                //Unit doesn't have required zeta
                let playerZeta = playerUnit.data.zeta_abilities.find(z => z.toLowerCase() === zeta.id.toLowerCase());
                if(playerZeta === undefined || playerZeta.length === 0) {
                    ret.success = false;
                    ret.shouldBreak = this.breaksTeamComposition(poolUnit);
                    return ret;
                }                                                
            }                                            
        }

        return ret;
    }

    private breaksTeamComposition(poolUnit : ITerritoryTeamUnit) : boolean {
        return !poolUnit.isReplaceable && !poolUnit.isReserve;
    }
}