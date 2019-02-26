import { IIntentHandler } from '../interfaces/IIntentHandler';
import { TwService } from '../services/twService';
import { IntentExecutor } from '../helpers/intentExecutor';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { Message, RichEmbed } from 'discord.js';
import { Observable } from 'rxjs/Observable';
import { ITerritoryTeam } from '../interfaces/ITerritoryTeam';
import { ITerritoryTeamUnit } from '../interfaces/ITerritoryTeamUnit';
import { UnitService } from '../services/unitService';
import { INicknameConfig } from '../interfaces/INicknameConfig';
let util = require('util');

export class TwPoolCommand implements IIntentHandler {
    intent = 'pool';
    intentDepth = 2;

    private _twService : TwService;
    private _unitService : UnitService;
    private _executor : IntentExecutor;


    constructor(private dbCfg : IDatabaseConfig, private nicknameCfg : INicknameConfig) {
        this._twService = new TwService(dbCfg);
        this._unitService = new UnitService(dbCfg, nicknameCfg);
    }

    protected _commandMap : { handler: IIntentHandler, desc : string }[] = [        
        { 
            //TODO: this should add a team to the pool rather than directly to a territory.
            //Add an argument (e.g. allocateto) to also allocate the team to 1 or more territories
            handler: { 
              intent: 'add', 
              execute: (message, params) => this.addTeam(message, params) 
            },
            desc: `Add a team to the TW team pool. Provide mandatory zetas in parenthesis after unit name. 
            Prepend "~" to unit name if it can be replaced by a reserve. Append --pref-gear if better geared reserves should be used over starting lineup.
             Syntax: ${this.intent} add <team_name_no_whitespace> <unit1 (zeta-name), unit2, unit3, ~unit4, ~unit5 [reserve1, reserve2]>` 
        },
        { 
            handler: { 
                intent: 'remove', 
                execute: (message, params) => this.removeTeam(message, params) 
            },
            desc: `Remove a team from the team pool. Syntax: ${this.intent} remove <team-name>`
        } 
     ];


    execute(m: Message, params: string[]) : Observable<boolean> {
        if(this._executor === undefined) {
            this._executor = new IntentExecutor(this._commandMap, this.intent);
            this._executor.intentDepth = this.intentDepth;
            this._executor.setDefaultHandler((m, p) => this.viewPool(m), 'View TW Summary');

        }
            
        return this._executor.tryExecute(m);
     }

     viewPool(m: Message) : Observable<boolean> {
         return Observable.create(o => {
            this._twService.viewPool(m.guild.id).subscribe(
                pool => {                    
                    if(pool === undefined) {
                        m.reply('There are no teams in the pool.');
                        o.next(true);
                        o.complete();
                        return;
                    }

                    let embed = new RichEmbed();
                    embed.setTitle('Territory War Team Pool');

                    for(let team of pool) {
                        embed.addField(team.name, 
                            `${team.units.filter(u => !u.isReserve).map(u => `${[...Array((u.zetasRequired||[]).length)].map(_ => 'z').join('')}${u.unitName}${(u.isReplaceable ? ' [Replaceable]' : '')}`).join(', ')} \n(Reserves: ${team.units.filter(u => u.isReserve).map(u => u.unitName).join(', ')})`)
                    }

                    m.channel.sendEmbed(embed);

                    o.next(true);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
         });
     }

     removeTeam(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0){
                m.reply('Please provide a team name so I can remove it.');
                o.next(false);
                o.complete();
                return;
            }

           this._twService.removeTeam(m.guild.id, params[0]).subscribe(
               success => {
                   m.reply(success ? 'I\'ve removed that team from the list.' : 'Apologies, I wasn\'t able to remove that team.');
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

    //TODO: refactor as method is too long
    addTeam(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => { 
            //Zetas provided in angle brackets e.g. Bossk <On The Hunt>
            //Swappable unit names preceeded with "~" e.g. ~Greedo
            //Acceptable leaders marked with "(L)" e.g. Bossk (L)
            //Gear thresholds provided in curly brackets e.g. Greedo {>G9}
            //Reserve units provided in square brackets e.g. [Embo, Zam Wesell]

            let team : ITerritoryTeam = {                
                name: params[0],
                units: []
            };

            //Skip territory and team name
            let isReservesList = false;
            let isZetaList = false;
            let parsingUnitName = false;
            let parsingZetaName = false;
            let zetaNameEnding = false;
            for(let param of params.slice(1)) {                
                if(param.startsWith('[')) isReservesList = true; //Reserves in square brackets
                if(param.startsWith('<')) isZetaList = true;
                if(param.endsWith('>') || param.endsWith('>,')) {
                    isZetaList = false;
                    zetaNameEnding = true;
                 } //Two specific conditions because param list is split by whitespace.
                 
                //Special sub params
                //TODO:
                                
                //For zeta lists, execute separate logic to add the params to zeta list
                if(isZetaList || zetaNameEnding) {
                    let lastUnit = team.units[team.units.length -1];
                    if(parsingZetaName) { //Mid zeta name, append
                        lastUnit.zetasRequired[lastUnit.zetasRequired.length -1] =
                         lastUnit.zetasRequired[lastUnit.zetasRequired.length -1].concat(' ', this.cleanString(param))
                    } else { //New zeta name, create
                        if(lastUnit.zetasRequired === undefined) lastUnit.zetasRequired = [];
                        lastUnit.zetasRequired.push(this.cleanString(param));
                    }
                    parsingZetaName = parsingUnitName = !param.endsWith(','); //',' === end of zeta name.
                    zetaNameEnding = false;
                } else { //Not a zeta list, 
                    //Unit is tagged as a leader
                    if(param.toUpperCase() === '(L)' || param.toUpperCase() === '(L),') {
                        let lastUnit = team.units[team.units.length -1];
                        lastUnit.isLeader = true;                            
                    } else if(param.startsWith('{')) { //Unit has a minimum gear level requirement
                        let gearTokenMatch = param.match(/{G(\d{1,2})}/i);
                        if(gearTokenMatch === undefined) continue; //Skip this, whatever it is. It shouldn't be using special curly brackets.

                        let lastUnit = team.units[team.units.length -1];
                        lastUnit.minimumGearTier = parseInt(gearTokenMatch[1]);
                    } else {
                        if(parsingUnitName && !param.startsWith('[')) { //Mid unit name, append
                            let lastUnit = team.units[team.units.length -1];                        
                            lastUnit.unitName = lastUnit.unitName.concat(' ', this.cleanString(param));
                        } else {                        
                            //New unit name, create
                            let unit : ITerritoryTeamUnit = {
                                unitName: this.cleanString(param),
                                isReplaceable: param.startsWith('~'),
                                isReserve: isReservesList,
                                zetasRequired: []
                            };
                            team.units.push(unit);                                               
                        }
                    }

                    parsingUnitName = !param.endsWith(',');
                }        
            }

            //We need to check the units exist so that we can match them against user rosters later on.
            this._unitService.unitsExist(team.units.map(u => u.unitName)).subscribe(
                matches => {
                    //Check for non-existent units
                    let unmatchedUnits = matches.filter(m => m.matchedUnits.length === 0);
                    if(unmatchedUnits.length > 0) {
                        m.reply(`I was unable to verify the following units exist, please make sure they're spelled correctly: ${unmatchedUnits.map(uu => uu.unitProvided).join(', ')}`);
                        o.next(false);
                        o.complete();
                        return;
                    }

                    console.log(`matches: ${util.inspect(matches)}`);                    
                    //More than one match for a unit and, more than one exact match OR no exact match at all.
                    let ambiguousMatches = matches.filter(m => m.matchedUnits.length > 1 && 
                        (m.matchedUnits.filter(mu => mu.exactMatch).length > 1 || m.matchedUnits.every(mu => !mu.exactMatch)));
                    
                    console.log(`ambiguous matches: ${util.inspect(ambiguousMatches)}`);
                    
                    if(ambiguousMatches.length > 0) {
                        m.reply(`The following unit terms are too ambiguous, please refine the terms: ${ambiguousMatches.map(am => am.unitProvided).join(', ')}`);
                        o.next(false);
                        o.complete();
                        return;
                    }

                    //Update each team unit with the proper name
                    for(let teamMember of team.units) {
                        let match = matches.find(m => m.unitProvided === teamMember.unitName);
                        let exactMatch = match.matchedUnits.find(m => m.exactMatch);
                        teamMember.unitName = exactMatch === undefined ? match.matchedUnits[0].unit.name : exactMatch.unit.name;
                    }

                    //Add the team!
                    this._twService.addTeam(m.guild.id, team).subscribe(
                        success => {                    
                            let message = success ? 'I successfully added the team to the list' :
                                'There was a problem adding that team, please try again. You may need to set up a new TW configuration (tw new-tw)';
                            m.reply(message);
                            o.complete();
                        },
                        err => {              
                            o.error(err);
                            o.complete();
                        }                
                    );
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );            
        });
     }

     private cleanString(text : string) : string {
         return text.replace('~', '').replace('[','').replace(']','').replace('<','').replace('>','').replace(',','');
     }
}