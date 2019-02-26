import { IIntentHandler } from "../interfaces/IIntentHandler";
import { TwService } from "../services/twService";
import { IntentExecutor } from "../helpers/intentExecutor";
import { IDatabaseConfig } from "../interfaces/IDatabaseConfig";
import { Message, RichEmbed } from 'discord.js';
import { Observable } from "rxjs/Observable";
import { DelimitedArrayParser } from '../helpers/delimitedStringParser';
import { ArrayExtensions } from '../extensions/arrayExtensions';
let util = require('util');
const aex = ArrayExtensions;

export class TwConfigCommand implements IIntentHandler {
    intent = 'config';

    intentDepth = 2;

    private _twService : TwService;
    private _executor : IntentExecutor;

    constructor(private dbCfg : IDatabaseConfig) {
        this._twService = new TwService(dbCfg);
    }

    protected _commandMap : { handler: IIntentHandler, desc : string }[] = [
        { 
            handler: { 
                intent: 'defensiveslots', 
                execute: (message, params) => this.setDefensiveSlots(message, params) 
            },
            desc: `Sets the number of defensive slots to fill. Syntax: ${this.intent} defensiveslots <slotCount>`
        },       
        { 
            handler: { 
                intent: 'excludedplayers', 
                execute: (message, params) => this.setExcludedPlayers(message, params) 
            },
            desc: `Set excluded players list. Syntax: ${this.intent} excludedplayers <player1, player2, ...>`
        },
        {
            handler: {
                intent: 'mingear',
                execute: (message, params) => this.setMinGearRequirement(message, params)
            },
            desc: `Set a globally recognised minimum gear requirement for defensive units. Gear levels set at unit level will override this.
            Syntax: ${this.intent} mingear G11`
        }
     ];


    execute(m: Message, params: string[]) : Observable<boolean> {
        if(this._executor === undefined) {
            this._executor = new IntentExecutor(this._commandMap, this.intent);
            this._executor.intentDepth = this.intentDepth;
            this._executor.setDefaultHandler((m, p) => this.showConfig(m), 'TW Config');
        }
            
        return this._executor.tryExecute(m);
     }

     showConfig(m: Message) : Observable<boolean> {
         return Observable.create(o => {
            this._twService.getTwConfig(m.guild.id).subscribe(
                cfg => {
                    let embed = new RichEmbed();
                    embed.setTitle('Territory War Config');
                    embed.setDescription('Here are the details of your current TW configuration.');
                    let grouped = ArrayExtensions.groupBy(cfg.teams, t => t.territory);

                    let t1 = grouped.has('T1') ? grouped.get('T1').length : 0;
                    let t2 = grouped.has('T2') ? grouped.get('T2').length : 0;
                    let s1 = grouped.has('S1') ? grouped.get('S1').length : 0;
                    let s2 = grouped.has('S2') ? grouped.get('S2').length : 0;

                    let m1 = grouped.has('M1') ? grouped.get('M1').length : 0;
                    let m2 = grouped.has('M2') ? grouped.get('M2').length : 0;

                    let b1 = grouped.has('B1') ? grouped.get('B1').length : 0;
                    let b2 = grouped.has('B2') ? grouped.get('B2').length : 0;
                    let b3 = grouped.has('B3') ? grouped.get('B3').length : 0;
                    let b4 = grouped.has('B4') ? grouped.get('T1').length : 0;                    

                    embed.addField('Defensive Slots', cfg.defensiveSlots || 25);
                    embed.addField('Excluded Players', aex.isUndefinedNullOrEmpty(cfg.excludedPlayers) ? 'N/A' : cfg.excludedPlayers.join(', '));
                    embed.addField('Default Minimum Gear Requirement', cfg.minimumGearRequirement || 'N/A');
                    embed.addField('Pool Teams', cfg.pool.length || 0); 
                    //Thanks https://www.tablesgenerator.com/text_tables 
                    //Only downside to using a backticked string is the tab preservation in the string, so
                    //the table has to be off to the left like this unfortunately.
                    //I could 
                    
                    let table = '+----+----+----+----+'
                        .concat('\n', '| S2 | S1 | T2 | T1 |')
                        .concat('\n', `|  ${s2} |  ${s1} |    |    |`)
                        .concat('\n', `+----+----+  ${t2} +  ${t1} +`)
                        .concat('\n', '| M2 | M1 |    |    |')
                        .concat('\n', `+  ${m2} +  ${m1} +----+----+`)
                        .concat('\n', '|    |    | B2 | B1 |')
                        .concat('\n', '+----+----+    +    +')
                        .concat('\n', `| B4 | B3 |  ${b2} |  ${b1} |`)
                        .concat('\n', `|  ${b4} |  ${b3} |    |    |`)
                        .concat('\n', '+----+----+----+----+');
                    
                    embed.addField('Number of Pool Teams Allocated Per Territory', `\`\`\`${table}\`\`\``);
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

     setMinGearRequirement(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                this._twService.getTwConfig(m.guild.id).subscribe(
                    cfg => {
                        let embed = new RichEmbed();
                        embed.setTitle('Territory War Config');
                        embed.addField('Current Minimum Gear Requirement', cfg.minimumGearRequirement);
                        m.channel.send({embed});

                        o.next(true);
                        o.complete();
                    },
                    err => {
                        o.error(err);
                        o.complete();
                    }
                );
                return;                
            }

            let gear = parseInt(params[0]);
            if(isNaN(gear)) {
                let match = params[0].match(/G(\d{1,2})/i);

                if(match === undefined || match.length === 0) {
                    m.reply(`Apologies, minimum gear requirement value must be a number.`);
                    o.next(false);
                    o.complete();
                    return;
                }

                gear = parseInt(match[1]);
            }
            
            this._twService.setMinGearRequirement(m.guild.id, gear).subscribe(
                success => {
                    m.reply(success ? `Minimum gear requirement set to ${gear}` : `I wasn't able to update the minimum gear requirement.`);
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

     setDefensiveSlots(m: Message, params: string[]) : Observable<boolean> {
         return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                this._twService.getTwConfig(m.guild.id).subscribe(
                    cfg => {
                        let embed = new RichEmbed();
                        embed.setTitle('Territory War Config');
                        embed.addField('Current Defensive Slots', cfg.defensiveSlots);
                        m.channel.send({embed});

                        o.next(true);
                        o.complete();
                    },
                    err => {
                        o.error(err);
                        o.complete();
                    }
                );
                return;                
            }

            let slots = parseInt(params[0]);
            if(isNaN(slots)) {
                m.reply(`Apologies, defensive slots value must be a number.`);
                o.next(false);
                o.complete();
                return;
            }
            
            this._twService.setDefensiveSlots(m.guild.id, slots).subscribe(
                success => {
                    m.reply(success ? `Defensive slots set to ${slots}` : `I wasn't able to update the defensive slots.`);
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

     setExcludedPlayers(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                this._twService.getTwConfig(m.guild.id).subscribe(
                    cfg => {
                        let embed = new RichEmbed();
                        embed.setTitle('Territory War Config');
                        embed.addField('Excluded Players', cfg.excludedPlayers === undefined || cfg.excludedPlayers.length === 0 ? 
                        'N/A' : cfg.excludedPlayers.join(', '));
                        m.channel.send({embed});

                        o.next(true);
                        o.complete();
                    },
                    err => {
                        o.error(err);
                        o.complete();
                    }
                );
                return;                
            }
            
            let parser = new DelimitedArrayParser();  
            let parsedPlayers = parser.parse(params);
            let players = parsedPlayers.parsedItems.filter(i => !i.startsWith('--'));
            let flags = parsedPlayers.parsedItems.filter(i => i.startsWith('--'));
            //If we expanded to allow flags alongside playernamers this will break, but it should be fine for clearing down.                  
            this._twService.setExcludedPlayers(m.guild.id, players, flags).subscribe(
                success => {
                    let response = success ? `Excluded players set to ${parsedPlayers.parsedItems.join(', ')}` :
                    `I wasn't able to update the excluded players list.`;

                    if(flags.some(f => f.toLowerCase() === '--clear') && success)
                        response = 'Excluded player list has been cleared down';

                    m.reply(response);
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
}