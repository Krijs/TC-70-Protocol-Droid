import { IIntentHandler } from "../interfaces/IIntentHandler";
import { IntentExecutor } from "../helpers/intentExecutor";
import { Message, RichEmbed } from 'discord.js';
import { Observable } from "rxjs/Observable";
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { UnitService } from '../services/unitService';
import { INicknameConfig } from '../interfaces/INicknameConfig';
import { IArgValue } from '../interfaces/IArgValue';

var cron = require('node-cron');
let util = require('util');

export class ScheduleCommand implements IIntentHandler {
    intent = 'schedule';
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
              intent: 'add', 
              execute: (message, params) => this.addScheduledMessage(message, params) 
            },
            desc: `Add a message schedule. Syntax: ${this.intent} add <message> --at <datetime> [--until <datetime>][--channel <#channel-name>][--monthly/--daily/--hourly/--weekly/--no-repeat]` 
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

    addScheduledMessage(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {   
            let flags = ['daily', 'hourly', 'weekly', 'every-minute', 'no-repeat'];
            let args  = ['at', 'until', 'channel']; 
            let argValues : IArgValue[] = [];  
            
                        
            let paramsNoFlags = params.filter(p => !flags.some(f => `--${f}` === p.toLowerCase()));
            let message = '';
            let index = -1;
            let parsingArg = false;

            for(let item of paramsNoFlags) {
                index++;
                if(args.some(a => `--${a}` === item.toLowerCase())) {
                    //we're in an arg!
                    parsingArg = true;
                    argValues.push({ arg: item.replace('--','').toLowerCase(), value: '' });
                    continue;
                }
                if(parsingArg) {
                    let currentArg = argValues[argValues.length-1];
                    currentArg.value += ` ${item}`;
                } else {
                    message += ` ${item}`;
                }                       
            }

            //Schedule stuff
            if(!argValues.some(av => av.arg === 'at')) {
                m.reply('Please provide a schedule date.');
                o.complete();
                return;
            }

            //Get time basis
            let minBasis = params.some(p => p.toLowerCase() === '--every-minute');
            let hrBasis = params.some(p => p.toLowerCase() === '--hourly');
            let dayBasis = params.some(p => p.toLowerCase() === '--daily');
            let wkBasis = params.some(p => p.toLowerCase() === '--weekly');
            let mthBasis = params.some(p => p.toLowerCase() === '--monthly');

            //Get CRON bits
            let scheduleDate = argValues.find(av => av.arg === 'at');
            let scheduleDateParsed = new Date(scheduleDate.value);
            let sec = scheduleDateParsed.getSeconds();
            let min = params.some(p => p.toLowerCase() === '--every-minute') ? '1-59' : scheduleDateParsed.getMinutes();
            let hr  = params.some(p => p.toLowerCase() === '--hourly') ? '1-23' : scheduleDateParsed.getHours();
            let dayOfMonth = params.some(p => p.toLowerCase() === '--daily') ? '1-31' : scheduleDateParsed.getDate();
            let month = params.some(p => p.toLowerCase() === '--monthly') ? '1-12' : scheduleDateParsed.getMonth() + 1;
            let dayOfWeek = params.some(p => p.toLowerCase() === '--weekly') ? '1-7' : '*';
            let channelArg = argValues.find(av => av.arg === 'channel');
            let repeat = !params.some(p => p.toLowerCase() === '--no-repeat');

            //Default bits for specific basis
            if(minBasis) {
                hr = dayOfMonth = month = dayOfWeek = '*';
            }
            if(hrBasis) {
                min = dayOfMonth = month = dayOfWeek = '*';
            }
            if(dayBasis) {
                month = dayOfWeek = '*';
            }                       

           //Set schedule
           let task = cron.schedule(`${sec} ${min} ${hr} ${dayOfMonth} ${month} ${dayOfWeek}`, () => {
               // let channelArg = argValues.find(av => av.arg === 'channel');
                console.log(util.inspect(channelArg));
                let channel = channelArg === null || channelArg === undefined ? m.channel : 
                    m.guild.channels.get(channelArg.value.replace('<','').replace('>','').replace('#','').trim());
                
                console.log(util.inspect(channel));
                channel.send(message); 
                
                if(!repeat) task.stop();
            }, { schedule: repeat });

            task.start();

            //Confirm schedule creation
            let channelName = channelArg === null || channelArg === undefined ? 'Current Channel' : channelArg.value;
            let markdownQuotes = '```';
            m.channel.send(`Channel Announcement created for ${channelName}
            ${markdownQuotes}js
Message:    "${message.trim()}"
Start:      "${scheduleDateParsed}"
Repeat:     "${repeat? 'Yes': 'No'}"
${markdownQuotes}`);

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