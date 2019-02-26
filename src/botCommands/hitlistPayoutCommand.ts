import { IIntentHandler } from '../interfaces/IIntentHandler';
import { Observable } from 'rxjs/Observable';
import { Message, RichEmbed } from 'discord.js';
import { PayoutHelper } from '../helpers/payoutHelper';
import { ITimezoneConfig } from '../interfaces/ITimezoneConfig';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { PayoutService, PayoutType, PayoutError } from '../services/payoutService';
import { DbConnector } from '../data/dbConnector';
import { ArrayExtensions } from '../extensions/arrayExtensions';
import { IPayout } from '../interfaces/IPayout';
import { IntentExecutor } from '../helpers/intentExecutor';
import { error } from 'util';

export class HitlistPayoutCommand implements IIntentHandler {
    intent = 'hitlist';
    intentDepth = 1;

    protected payoutType : PayoutType = PayoutType.Foe;
 
    protected _commandMap : { handler: IIntentHandler, desc : string }[] = [
        { 
            handler: { 
              intent: 'add', 
              execute: (message, params) => this.addPayout(message, params) 
            },
            desc: `Add a payout to the list. Syntax: ${this.intent} add <name> <time> <timezone> <emoji (optional)>` 
        },
        { 
            handler: { 
                intent: 'remove', 
                execute: (message, params) => this.removePayout(message, params) 
            },
            desc: `Remove a payout from the list. Syntax: ${this.intent} remove <name>`
        },
        { 
            handler: { 
                intent: 'clear', 
                execute: (message, params) => this.clearPayouts(message) 
            },
            desc: `Remove all payouts from the list. Syntax: ${this.intent} clear`
        }
     ];

     protected _payoutService : PayoutService;
     private _executor : IntentExecutor;

     constructor(protected timezones : ITimezoneConfig, protected dbCfg : IDatabaseConfig) { 
         this._payoutService = new PayoutService(this.payoutType, this.dbCfg);
     }
    
     execute(m: Message, params: any[]) : Observable<boolean> {
        if(this._executor === undefined) {
            this._executor = new IntentExecutor(this._commandMap, this.intent);
            this._executor.intentDepth = this.intentDepth;
            this._executor.setDefaultHandler((m, p) => this.showPayouts(m), 'View payouts');

        }
            
        return this._executor.tryExecute(m);
    }

    protected showPayouts(m:Message) : Observable<boolean> {
        return Observable.create(o => {
            this._payoutService.getPayouts(m.guild.id).subscribe(
                payouts => {
                    //Could be factored into one line but leaving as vars as easier to debug.
                    let itemsGrouped =    
                        Array.from(
                            ArrayExtensions.groupBy(
                                payouts.map(p => {
                                    p.timeToPayout = PayoutHelper.calculateTimeToPayout(p);
                                    return p;
                                }), 
                                //Can't use an object as a key in Maps, due to not being able to determine equality between objects
                                p => `${p.timeToPayout.hours||0}h ${p.timeToPayout.minutes||0}m`)
                        );
    
                        //TODO: Sorting doesn't work
                    let itemsSorted = itemsGrouped
                        .sort(this.comparePayoutArray);
    
                    let itemsMapped = itemsSorted
                        .map(po =>[
                            `**${po[0]} (${po[1][0].timezoneUTC})**`,
                            po[1].map(p => {
                                        let emoji = p.emoji ? `:${p.emoji}:` : '';
                                        return `${emoji}${p.name}`})
                                    .reduce((a,b) => `${a}, ${b}`)]);
                    
                    let embed  = new RichEmbed();
                    embed.setTitle(`Today's ${this.intent.charAt(0).toUpperCase()}${this.intent.substr(1)}`)
                         .setThumbnail('https://i.imgur.com/BDdrJOX.png') //Should really use local imgs
                         .setColor(this.payoutType === PayoutType.Friendly ? '#79B74C' : '#C70039')
                         .addBlankField();
                    itemsMapped.forEach((item, idx) => {
                        embed.addField(item[0], item[1]);
                        if(idx < itemsMapped.length-1) embed.addBlankField();
                    });
    
                    m.channel.send({embed});
                    o.complete();
                },
                error => {
                    m.reply(`I'm unable to display payout info right now. Try again later.`);
                    o.error(error);
                }
            );
        });    
    }

    protected addPayout(m:Message, params : string[]) : Observable<boolean> {
        return Observable.create(o => {
            let payout = PayoutHelper.buildPayoutFromParams(params, m.guild.id, this.timezones);
            this._payoutService.addPayout(payout).subscribe(
                success => {
                    m.reply(`Okay, added ${payout.name} with a payout at ${payout.time} ${payout.timezone}` +
                    `${payout.timezone.startsWith('UTC') ? '' : ` (${payout.timezoneUTC})`}. :moneybag: :alarm_clock:`);
                    o.complete();
                },
                error => {
                    let message : string;
                    switch(<PayoutError>error) {
                        case PayoutError.InvalidPayout:
                            message = `Sorry, can't add that payout. :( \nFormat: payouts add <name> <time (hh:mm)> <timezone> <emoji>`;
                            break;
                        case PayoutError.InvalidTimezone:
                            message = `Sorry, but ${payout.timezone} is not recognised.`;
                            break;
                        default:
                            message = 'Unable to add that payout right now. Try again later.';
                            break;
                    }

                    m.reply(message);
                    o.complete();
                }
            );
        });
    }

    protected removePayout(m:Message, params : string[]) : Observable<boolean> {
        return Observable.create(o => {
            let name = params.length > 0 ? params[0] : undefined;

            this._payoutService.removePayout(name, m.guild.id).subscribe(
                success => {
                    m.reply(success ? 
                        `Removed payout for ${name}`
                        : `Couldn't remove payout for ${name}`);
                    o.complete();
                },
                error => {
                    let message : string;
                    switch(<PayoutError>error) {
                        case PayoutError.InvalidParameter:
                            message = `Here's the syntax to remove a payout:\npayouts remove <name>`;
                            break;
                        default:
                            message = `Couldn't remove payout for ${name}`;
                            break;
                    }

                    m.reply(message);
                    o.complete();
                }
            );
        });
    }

    protected clearPayouts(m:Message) {
        return Observable.create(o => {
            this._payoutService.clearPayouts(m.guild.id).subscribe(
                success => {
                    m.reply('Payouts cleared down successfully.');
                    o.complete();
                },
                error => {
                    m.reply(`Couldn't clear down payouts. Try again later.`);
                    o.complete();
                }
            );
        });
    }

    protected showHelp(m:Message) : Observable<boolean> {
        return Observable.create(o => {
            let response : string[] = [];
            response.push('Here is some help on how to manage payouts:\r\n');
            response = response.concat(this._commandMap.map(i => `**${i.handler.intent}**: ${i.desc}\r\n`));

            m.reply(response.join('\r\n'));
            o.complete();
        });
    }

    protected comparePayoutArray(a : [string, IPayout[]], b : [string, IPayout[]]) {
        let aTTP = a[1][0].timeToPayout;
        let bTTP = b[1][0].timeToPayout;
        if(aTTP.hours > bTTP.hours) return 1;
        if(bTTP.hours < bTTP.hours) return -1;

        if(aTTP.hours === bTTP.hours) {
            let aMinutesRounded = Math.round(aTTP.minutes);
            let bMinutesRounded = Math.round(bTTP.minutes);

            if(aMinutesRounded > bMinutesRounded) return 1;
            if(aMinutesRounded < bMinutesRounded) return -1;

            return 0;
        }

        return 0;
    }
    
}