import { IIntentHandler } from "../interfaces/IIntentHandler";
import { IntentExecutor } from "../helpers/intentExecutor";
import { Message, RichEmbed } from 'discord.js';
import { Observable } from "rxjs/Observable";
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { UnitService } from '../services/unitService';
import { INicknameConfig } from '../interfaces/INicknameConfig';

export class UnitCommand implements IIntentHandler {
    intent = 'unit';
    intentDepth = 1;

    private _executor : IntentExecutor;
    private _unitService : UnitService;

    constructor(private dbCfg : IDatabaseConfig, private nicknameCfg : INicknameConfig) {
        this._unitService = new UnitService(dbCfg, nicknameCfg);      
    }

    protected _commandMap : { handler: IIntentHandler, desc : string }[] = [        
        { 
            //TODO: this should add a team to the pool rather than directly to a territory.
            //Add an argument (e.g. allocateto) to also allocate the team to 1 or more territories
            handler: { 
              intent: 'sync', 
              execute: (message, params) => this.syncUnits(message, params) 
            },
            desc: `Sync unit data with swgoh.gg
             Syntax: ${this.intent} sync` 
        },
        { 
            handler: { 
                intent: 'query', 
                execute: (message, params) => this.queryUnits(message, params) 
            },
            desc: `Query for units that match a given phrase. Add the --exact flag to get an exact match only. Syntax: ${this.intent} query <phrase> --exact`
        } 
     ];

    execute(m: Message, params: string[]) : Observable<boolean> {
        if(this._executor === undefined) {
            this._executor = new IntentExecutor(this._commandMap, this.intent);
            this._executor.intentDepth = this.intentDepth;
            this._executor.setDefaultHandler((m, p) => this.showUnitStats(m), 'See stats about the unit data');

        }
            
        return this._executor.tryExecute(m);
    }

    syncUnits(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            m.reply(`I will automatically sync units every three days. 
            Ad-hoc syncing is currently not enabled to avoid thrasing swgoh.gg's API.
            I will be able to ad-hoc sync once my Maker implements a throttling system.`);
            o.complete();
        });
    }

    queryUnits(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                m.reply('Please provide a search string so I can narrow down my search.');
                o.complete();
                return;
            }
            this._unitService.getUnits(params.filter(p => p.toLowerCase() !== '--exact').join(' '),
             params.some(p => p.toLowerCase() === '--exact')).subscribe(
                filteredUnits => {
                    if(filteredUnits === undefined || filteredUnits.length === 0) {
                        m.reply(`I wasn't able to find any units with the supplied criteria.`);
                        o.next(false);
                        o.complete();
                        return;
                    }

                    if(filteredUnits.length > 10) {
                        m.reply(`The search criteria is too vague and would produce a list of units that is too large. Please narrow your search.`);
                        o.next(false);
                        o.complete();
                        return;
                    }
                        
                    //Print an embed for each unit
                    for(let unit of filteredUnits) {                    
                        let embed = new RichEmbed();
                        embed.setTitle(unit.unit.name);
                        embed.setColor(unit.unit.alignment === 'Light Side' ? '#4286f4' : '#f44253');
                        embed.setThumbnail(`http:${unit.unit.image}`);                       
                        embed.setDescription(`
                        ${unit.unit.alignment}, ${unit.unit.role}                       
                        `);
                        embed.addField('Bio', unit.unit.description);
                        embed.addField('Shards to activate', unit.unit.activate_shard_count);
                        embed.addField('Kit Aspects', unit.unit.ability_classes.join(', '));
                        m.channel.send({embed});
                    }

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

    showUnitStats(m: Message) {
        return Observable.create(o => {
            m.reply(`Apologies, I am currently analysing the data to determine the most useful data to show you.`);
            o.complete();
        });
    }
}