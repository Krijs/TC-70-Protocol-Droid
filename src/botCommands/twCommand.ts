import { IIntentHandler } from "../interfaces/IIntentHandler";
import { Message, Emoji, RichEmbed, TextChannel } from 'discord.js';
import { Observable } from 'rxjs/Observable';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { DbConnector } from "../data/dbConnector";
import { ITerritoryTeam } from '../interfaces/ITerritoryTeam';
import { ITerritoryTeamUnit } from '../interfaces/ITerritoryTeamUnit';
import { TwService } from '../services/twService';
import { ArrayExtensions } from '../extensions/arrayExtensions';
import { IntentExecutor } from '../helpers/intentExecutor';
import { ITwConfig } from '../interfaces/ITwConfig';
import { TwPoolCommand } from "./twPoolCommand";
import { TwConfigCommand } from "./twConfigCommand";
import { GuildService } from '../services/guildService';
import { IMatchedPlayer } from '../interfaces/IMatchedPlayer';
import { IFlattenedPlayerTeam } from '../interfaces/IFlattenedPlayerTeam';
import { IMatchedTeam } from '../interfaces/IMatchedTeam';
import { AsyncResource } from "async_hooks";
import { StringExtensions } from '../extensions/stringExtensions';
import { INicknameConfig } from "../interfaces/INicknameConfig";
import { TwTeamMatcher } from "../helpers/TwTeamMatcher";


const util = require('util');

export class TwCommand implements IIntentHandler {
    intent: string | string[] = 'tw';
    intentDepth = 1;

    private _twService : TwService;
    private _guildService : GuildService;
    private _executor : IntentExecutor;

    constructor(private dbCfg : IDatabaseConfig, private nicknameConfig: INicknameConfig) {
        this._twService = new TwService(dbCfg);
        this._guildService = new GuildService(dbCfg);
    }

    protected _commandMap : { handler: IIntentHandler, desc : string }[] = [
        { 
            handler: { 
                intent: 'newtw', 
                execute: (message, params) => this.setupTw(message, params) 
            },
            desc: `Starts a new TW configuration with ability to optionally re-use previous configuration, and ability to exclude players. Syntax: ${this.intent} newtw <reuse-config> <exclude player1, player2, ....>`
        },
        { 
            handler: new TwPoolCommand(this.dbCfg, this.nicknameConfig), 
            desc: `View and manage the TW team pool. See ${this.intent} pool ? for help`},               
        { 
            handler: { 
                intent: 'allocate', 
                execute: (message, params) => this.allocate(message, params) 
            },
            desc: `Allocate teams from the pool to a territory. Syntax: ${this.intent} allocate <territory> <team1, team2, ...>`
        },
        { 
            handler: { 
                intent: 'deallocate', 
                execute: (message, params) => this.deallocate(message, params) 
            },
            desc: `Deallocate teams from a territory. Syntax: ${this.intent} deallocate <territory> <team1, team2, ...>`
        },
        { 
            handler: { 
                intent: 'clear', 
                execute: (message, params) => this.clearTerritory(message, params) 
            },
            desc: `Clear a territory of teams. Syntax: ${this.intent} clear <territory>`
        },
        { 
            handler: { 
                intent: 'fill', 
                execute: (message, params) => this.fillTerritory(message, params) 
            },
            desc: `Fill a territory with player teams based on allocated pool teams. Use --dry-run to see picked teams without filling the territory. 
            Syntax: ${this.intent} fill <territory> [--dry-run]`
        },
        { 
            handler: new TwConfigCommand(this.dbCfg),
            desc: `Edit the config. See ${this.intent} config ? for help`
        } 
     ];

    execute(m: Message, params: string[]) : Observable<boolean> {
        if(this._executor === undefined) {
            this._executor = new IntentExecutor(this._commandMap, this.intent);
            this._executor.intentDepth = this.intentDepth;
            this._executor.setDefaultHandler((m, p) => this.getTeams(m), 'View TW Summary');
        }
            
        return this._executor.tryExecute(m);
     }

     fillTerritory(m: Message, params: string[]) : Observable<boolean> {
         return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                m.reply('Please supply a territory to allow me to suggest teams.');
                o.next(false);
                o.complete();
                return;
            }

            this._guildService.getCachedGuildData(m.guild.id).subscribe(
                guild => {
                    //We've got guild data, now let's get teams assigned to given territory
                    this._twService.getTwConfig(m.guild.id).subscribe(
                        cfg => {
                            let teamsForTerritory = cfg.teams.filter(t => t.territory.toLowerCase() === params[0].toLowerCase());
                            if(teamsForTerritory === undefined || teamsForTerritory.length === 0) {
                                m.reply('I am not able to fill a territory that doesn\'t have any pool teams allocated to it.');
                                o.next(false);
                                o.complete();
                                return;
                            }
                            
                            //Match player teams for territory(ies)
                            let matcher = new TwTeamMatcher(cfg, guild);
                            let territoryTeams2 = matcher.matchTeams(teamsForTerritory);                                
                            let messageChunks = this.buildTeamSuggestionsMessages(territoryTeams2, cfg);                                       

                            //Send message in chunks since discord messages can only be 2000 characters in length.
                            for(let chunk of messageChunks) {
                                m.channel.send(chunk);                                          
                            } 
                            
                            //Dry run, bail
                            if(params.some(p => p.toLowerCase() === '--dry-run')) {
                                o.next(true);
                                o.complete();
                                return;
                            }

                            //Save assignments!
                            let teams = Array.from(territoryTeams2).map(t => t[1]).reduce(t => t);
                            this._twService.assignPlayerTeams(m.guild.id, teams);
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            )
         });
     }

     private buildTeamSuggestionsMessages(teamsByTerritory : Map<string, IMatchedTeam[]>, cfg : ITwConfig, chunkSize : number = 1999) : string[] {
        let message = '';                                                                                                          
        for(let [territory,teams] of teamsByTerritory) {
            let title = `**__${territory} - ${teams.length > cfg.defensiveSlots ? cfg.defensiveSlots : teams.length}/${cfg.defensiveSlots} (${cfg.teams.filter(t => t.territory === territory).map(t => t.name).join(', ')})__**`;
            let field = teams.filter(t => t.teamMembers.length >= 5).sort((a,b) => {
                if(a.totalGp < b.totalGp) return 1;
                if(a.totalGp > b.totalGp) return -1;
                return 0;
            })
            .slice(0, teams.length < cfg.defensiveSlots ? teams.length : cfg.defensiveSlots)
            .map(t => `**${t.playerName}** - *${t.teamName}*\n${t.teamMembers.join(', ')} [${t.totalGp.toLocaleString('en-us')} GP]`).join('\n\n');  
            message = message.concat(title, '\n', field, '\n');
        }

        return StringExtensions.chunk(message, chunkSize);
     }
 
     allocate(m: Message, params: string[]) : Observable<boolean> {
         return Observable.create(o => {
            if(params === undefined || params.length < 2) {
                m.reply('Please provide a team name and a territory to allocate it to.');
                o.next(false);
                o.complete();
                return;
            }

            let territory = params[0];
            let teamName = params[1];

            this._twService.allocateTeam(m.guild.id, teamName, territory).subscribe(
                success => {
                    m.reply(success ? `Allocated ${teamName} to ${territory}` : `I wasn't able to allocate that team.`);
                    o.next(success);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
         });
     }

     deallocate(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
           if(params === undefined || params.length < 2) {
               m.reply('Please provide a team name and a territory to deallocate.');
               o.next(false);
               o.complete();
               return;
           }

           let territory = params[0];
           let teamName = params[1];

           this._twService.deallocateTeam(m.guild.id, teamName, territory).subscribe(
               success => {
                   m.reply(success ? `${teamName} no longer allocated to ${territory}` : `I wasn't able to deallocate that team.`);
                   o.next(success);
                   o.complete();
               },
               err => {
                   o.error(err);
                   o.complete();
               }
           );
        });
    }


     getTeams(m: Message) : Observable<boolean> {
         return Observable.create(o => {
            this._twService.getTwConfig(m.guild.id).subscribe(
                cfg => {
                    if(cfg === undefined || cfg.teams.length === 0) {
                        m.reply('No teams have been set up. Please add teams to see a summary.');
                        o.complete();
                        return;
                    }
                    
                    let teamsByTerritory = Array.from(ArrayExtensions.groupBy(cfg.teams, t => t.territory));
                    let embed = new RichEmbed();
                    embed.setTitle('Territory War Summary');
                    embed.setThumbnail('https://i.imgur.com/F58PQGx.png');
                    embed.setDescription(`Defensive Slots: ${cfg.defensiveSlots || '25?'}\nExcluded Players: ${cfg.excludedPlayers.length == 0 ? 'N/A' : cfg.excludedPlayers.join(', ')}`);                    
                    for(let territory of teamsByTerritory) {
                        // embed.addField(territory[0], territory[1].map(t => 
                        //     `${t.name}: ${t.units.filter(u => !u.isReserve).map(u => `${u.unitName}${(u.isReplaceable ? ' (Replaceable)' : '')}`).join(', ')} (Reserves: ${t.units.filter(u => u.isReserve).map(u => u.unitName).join(', ')})` ).join('\n'));
                        embed.addField(territory[0], territory[1].map(t => t.name).join(', '));
                    }
                    
                    m.channel.send({embed});
                    o.next(true);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            )
         });
     }

     clearTerritory(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0){
                m.reply('Please provide a territory name so I can clear it down.');
                o.next(false);
                o.complete();
            }

           this._twService.clearTerritory(m.guild.id, params[0]).subscribe(
               success => {
                   m.reply(success ? 'I\'ve cleared that territory down.' : 'Apologies, I wasn\'t able to clear down that territory.');
                   o.next(success);
                   o.complete();
               },
               err => {
                   o.error(err);
                   o.complete();
               }
           );
        });
     }

     setupTw(m: Message, params: string[]) : Observable<boolean> {
         return Observable.create(o => {
            let twConfig : ITwConfig = {
                excludedPlayers: [],
                teams: [],
                defensiveSlots: 25,
                pool: []
            };

            if(params !== undefined && params.length > 0) {
                let isExclusionList = false;
                let parsingExclusionName = false;
                for(let param of params) {
                    if(param.toLowerCase() === 'reuse-config') {
                        //TODO: get previous config to edit

                        isExclusionList = false;
                    }

                    if(param.toLowerCase() === 'exclude') {
                        isExclusionList = true;                        
                    }

                    if(!isExclusionList) continue;

                    //Add exclusions
                    if(parsingExclusionName) {
                        twConfig.excludedPlayers[twConfig.excludedPlayers.length -1] += ` ${param}`;
                    } else {
                        twConfig.excludedPlayers.push(param);
                    }
                }
            }

            this._twService.setupTw(m.guild.id, twConfig).subscribe(
                success => {
                    m.reply(`I've set up a new TW configuration as per your instruction.`);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
         });
     }

     
}