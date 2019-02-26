import { IIntentHandler } from "../interfaces/IIntentHandler";
import { Message, RichEmbed } from 'discord.js';
import { IntentExecutor } from "../helpers/intentExecutor";
import { IDatabaseConfig } from "../interfaces/IDatabaseConfig";
import { Observable } from "rxjs/Observable";
import { DbConnector } from '../data/dbConnector';
import { PayoutError } from '../services/payoutService';
import { IGuildMeta } from '../interfaces/IGuildMeta';
import { GuildService } from '../services/guildService';
import { SwgohGGService } from '../services/swgohggService';
import { error } from 'util';
import { IGuild } from '../interfaces/swgoh.gg/IGuild';

export class GuildCommand implements IIntentHandler {
    intent: string | string[] = 'guild';
    intentDepth = 1;

    private _executor : IntentExecutor;
    private _guildService : GuildService;
    private _swgohggService = new SwgohGGService();
   
    constructor(private dbCfg : IDatabaseConfig) {
        this._guildService = new GuildService(dbCfg);
    }

    protected _commandMap : { handler: IIntentHandler, desc : string }[] = [
        { 
            handler: { 
              intent: 'register', 
              execute: (message, params) => this.register(message, params) 
            },
            desc: `Register your guild, so that member details can be used for analysis. Syntax: ${this.intent} <swgoh.gg guild id>` 
        },
        { 
            handler: { 
              intent: 'update', 
              execute: (message, params) => this.update(message, params) 
            },
            desc: `Update your guild information from swgoh.gg Syntax: ${this.intent} update` 
        }
     ];

    execute(m: Message, params: string[]) : Observable<boolean> {
        if(this._executor === undefined) {
            this._executor = new IntentExecutor(this._commandMap, this.intent);
            this._executor.intentDepth = this.intentDepth;
            this._executor.setDefaultHandler((m, p) => this.guildDetails(m), 'View Guild Summary');

        }
            
        return this._executor.tryExecute(m);
     }

     update(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            //Get GuildMeta
            //Call Register with GuildMeta.guildId
            //TODO: add throttle register so that users can't spam register guilds.
            o.next(true);
            o.complete();
        });
     }

     register(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params.length === 0 || isNaN(parseInt(params[0]))) {
                m.reply('Invalid argument, please provide the guild ID from swgoh.gg for your guild.');
                o.complete();
                return;
            }

            let guild : IGuildMeta = {
                serverId: m.guild.id,
                guildId: parseInt(params[0]),
                refreshedAt: new Date()
            };

            m.reply('Registering guild ID...').then(msg => {
                let originalMsg = <Message>msg;
                this._guildService.registerGuild(guild).subscribe(
                    success => {
                        //TODO: import guild details.
                        originalMsg.edit('Guild registered! Pulling guild data...');
                        this._swgohggService.getGuildDetails(guild.guildId).subscribe(
                            guildData => {
                                let embed = this.buildGuildSummaryEmbed(guildData);
                                embed.setFooter('Caching in progress...');
                                originalMsg.edit({embed});

                                //TODO:
                                //We should use the Cache unless user forces a refresh
                                //Natural refreshes should occur once per day(?) when a data-touching action is taken.
                                this._guildService.cacheGuild(guild.serverId, guildData).subscribe(
                                    success => {
                                        embed.setFooter(`Cached @ ${new Date()}`);
                                        originalMsg.edit({embed});
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
                    },
                    err => {
                        o.error(err);
                        o.complete();                   
                    }
                );        
            });                
        });
     }

     guildDetails(m: Message) : Observable<boolean> {
        return Observable.create(o => {
            this._guildService.getCachedGuildData(m.guild.id).subscribe(
                data => {
                    let embed = this.buildGuildSummaryEmbed(data);
                    m.channel.sendEmbed(embed);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });
     }

     private buildGuildSummaryEmbed(guildData : IGuild) : RichEmbed {
        let embed = new RichEmbed();
        embed.setTitle(guildData.data.name);
        embed.setThumbnail('https://swgoh.gg/static/img/swgohgg-nav.png');                               
        embed.setDescription(
            `Members: ${guildData.data.member_count} \nGalactic Power: ${guildData.data.galactic_power.toLocaleString('en-us', {minimumFractionDigits: 0})}`);                                
        
        return embed;
     }
}