import { IIntentHandler } from "../interfaces/IIntentHandler";
import { Message, RichEmbed } from 'discord.js';
import { Observable } from 'rxjs/Observable';
import { IntentExecutor } from '../helpers/intentExecutor';
import { IRankRotation } from '../interfaces/IRankRotation';
import { PayoutService, PayoutType } from '../services/payoutService';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { DbConnector } from '../data/dbConnector';
import { IIntentCollection } from '../interfaces/IIntentCollection';
import { DateTime, Interval } from 'luxon';

export class RotationsCommand implements IIntentHandler {
    intent: string | string[] = 'rotations';

    private _payoutService : PayoutService;
    private _intents : IIntentCollection = [
        {
            handler: {
                intent: 'add',
                execute: (p,m) => this.addRotation(p,m)
            },
            desc: 'Add a payout rotation to the list. Syntax: rotations add <name1 name2 ...> <rank1 rank2 ...(optional)>'
        },
        {
            handler: {
                intent: 'status',
                execute: (p,m) => this.showRotation(p,m)
            },
            desc: 'View a rotation for a number of players. Syntax: rotations status <name1 name2 ...>'
        }
    ];

    constructor(private dbCfg : IDatabaseConfig) {
        this._payoutService = new PayoutService(PayoutType.Friendly, dbCfg);
    }

    execute(m: Message, params: any[]) : Observable<boolean> {
        let exec = new IntentExecutor(this._intents, this.intent);
        return exec.tryExecute(m);
    }

    private addRotation(m:Message, params : string[]) : Observable<boolean> {
        return Observable.create(o => {            
            let rotation : IRankRotation = {
                players: params.filter(p => isNaN(Number(p))),
                ranks: params.filter(p => !isNaN(Number(p))).map(p => Number(p)),
                serverId: m.guild.id
            };                      

            //Check if all of the names specified have a payout registered
            this._payoutService.getPayouts(m.guild.id).subscribe(
                payouts => {
                    let playerSet = new Set(rotation.players);                    
                    let filteredPayouts = payouts.filter(p => playerSet.has(p.name));

                    if(filteredPayouts.length < playerSet.size) {
                        m.reply('All players should have a payout specified first.');
                        o.complete();
                        return;
                    }

                    let payout = filteredPayouts.reduce(
                        (a,b) => a.timezoneUTC === b.timezoneUTC && a.time === b.time ? a : undefined);
                    
                    if(!payout) {
                        m.reply('All players should have the same payout (times and timezone must be equal)');
                        o.complete();
                        return;
                    }

                    rotation.payoutTime = payout.time;
                    rotation.payoutTimezoneUTC = payout.timezoneUTC;
                    rotation.rotationStarted = DateTime.local().setZone(payout.timezoneUTC).set({   
                        hour:0,
                        minute:0,
                        second:0,
                        millisecond:0
                    }).toISO();  
                                       
                    
                    //TODO: delete rotations that contain the players specified by the user

                    //Insert rotation
                    let dbc = new DbConnector(this.dbCfg);
                    dbc.connect((err, db) => {
                        if(err) {
                            //o.error(PayoutError.DbConnectionFailed);
                            m.reply('Unable to add rotation at the moment. Try again later.');
                            o.complete();
                            return;
                        }

                        db.collection('rotations').findOneAndUpdate(
                            { players: rotation.players },
                            rotation,
                            { upsert: true },
                            (err, res) => {
                                if(err) {
                                   // o.error(PayoutError.DbOperationFailed);
                                    m.reply('Unable to add rotation at the moment. Try again later.');
                                    o.complete();
                                    return;
                                }

                                m.reply(`Okay, added payout rotation for ${rotation.players.join(', ')}.`);
                                o.complete();
                            }
                        );
                    });
                }
            )
        });
    }

    private showRotation(m:Message, params : string[]) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            let names = params.filter(p => isNaN(Number(p)));
            let dayOffset = Number(params.find(p => !isNaN(Number(p))) || 0);

            dbc.connect((err, db) => {
                db.collection('rotations')
                    .findOne({ players: { $all: names }, serverId: m.guild.id })
                    .then((item : IRankRotation) => {                        
                        let today = DateTime.local().setZone(item.payoutTimezoneUTC).plus({days: dayOffset}); 
                        let startedDate = DateTime.fromISO(item.rotationStarted);                        
                        let daysSinceStart = Interval.fromDateTimes(startedDate, today).toDuration('days').toObject();  
                        
                        //Provide default rank numbers if user left them blank
                        let ranksProvided = item.ranks && item.ranks.length > 0;
                        item.ranks = ranksProvided ? item.ranks : [...Array(item.players.length).keys()];  

                        //Calculate the rank designations
                        let rankedPlayers : {name : string, rank : number}[] = [];
                        for(let i = 0;i < item.players.length;i++) {
                            let rankOrdinal = Math.floor(Math.abs(daysSinceStart.days||0) + i) % item.players.length;
                            rankedPlayers.push({ name: item.players[rankOrdinal], rank: item.ranks[i]});
                        }                                                                        
                        
                        //If ranks aren't provided, offset the rank numbers by one as the default ranks
                        //are generated from a zero-based index
                        let rankOffset = ranksProvided ? 0 : 1;
                        // m.reply(`\r\n${today.toFormat('yyyy-MM-dd')} rank designations:\r\n\r\n` +
                        //         rankedPlayers.map(p => `#${p.rank + rankOffset} -> **${p.name}**`).join('\r\n'));

                        let embed = new RichEmbed();
                        embed.setTitle(`Rank Designations`)
                             .setDescription(`Here are the rank designations for ${today.toFormat('yyyy-MM-dd')}`)
                             .setThumbnail('https://i.imgur.com/15SmBiw.png')
                             .addBlankField();
                        
                        rankedPlayers.forEach((item, idx) => 
                            embed.addField(`#${item.rank+rankOffset}`, item.name));
                        m.channel.send({embed});
                        
                        o.complete();
                    });
            });

        });
    }
}