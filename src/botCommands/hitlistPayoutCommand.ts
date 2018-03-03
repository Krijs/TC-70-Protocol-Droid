import { IIntentHandler } from '../interfaces/IIntentHandler';
import { Observable } from 'rxjs/Observable';
import { Message } from 'discord.js';
import { PayoutHelper } from '../helpers/payoutHelper';
import { ITimezoneConfig } from '../interfaces/ITimezoneConfig';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { PayoutService, PayoutType, PayoutError } from '../services/payoutService';
import { DbConnector } from '../data/dbConnector';
import { ArrayExtensions } from '../extensions/arrayExtensions';
import { IPayout } from '../interfaces/IPayout';

export class HitlistPayoutCommand implements IIntentHandler {
    intent = 'hitlist';

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
        },
        {
            handler: {
                intent: '?',
                execute: (message, params) => this.showHelp(message)
            },
            desc: `Shows help for payouts. Syntax: ${this.intent} ?`
        }
     ];

     protected _payoutService : PayoutService;

     constructor(protected timezones : ITimezoneConfig, protected dbCfg : IDatabaseConfig) { 
         this._payoutService = new PayoutService(this.payoutType, this.dbCfg);
     }
    
     execute(m: Message, params: any[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                this.showPayouts(m);
                o.complete();
                return;
            }
    
            let intent = params.shift();
    
            let matchedCommand = this._commandMap.find(cmd => cmd.handler.intent === intent);
            if(matchedCommand === undefined) return;
    
            matchedCommand.handler.execute(m, params).subscribe(null, null, () => o.complete());
        });
    }

    protected showPayouts(m:Message) {
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

                let itemsReduced = itemsMapped
                    .reduce((a, b) => a.concat([''], b), [''])
                    .join('\r\n');
                
                m.reply(itemsReduced.length <= 2 ? 'There are no payouts to show' : itemsReduced);
            },
            error => {
                m.reply(`I'm unable to display payout info right now. Try again later.`);
            }
        );
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