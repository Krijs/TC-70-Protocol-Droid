import { IIntentHandler } from '../interfaces/IIntentHandler';
import { Message } from 'discord.js';
import { MongoClient } from 'mongodb';
import { IBotConfig } from '../interfaces/IBotconfig';
import { IPrefixMap } from '../interfaces/IPrefixMap';
import { ServerPrefixManager } from '../serverPrefixManager';
import { error } from 'util';
import { Observable } from 'rxjs/Observable';
export class PrefixCommand implements IIntentHandler {
    intent: string = 'prefix';

    constructor(private botConfig : IBotConfig, private serverPrefixManager : ServerPrefixManager) {}

    execute(m: Message, params: any[]) : Observable<boolean> {
        return Observable.create(o => {
            if(params === undefined || params.length === 0) {
                o.complete();
                return;
             } //temp

            let prefixMap : IPrefixMap = {
                serverId: m.guild.id,
                prefix: params[0]
            };
            this.serverPrefixManager.addOrUpdatePrefix(prefixMap).subscribe(
                success => {
                    m.reply(success ? 
                                `Updated prefix to ${params[0]}` 
                                : 'Sorry, unable to change prefix right now. Try again later.');
                    o.complete();
                },
                error => {
                     m.reply('Sorry, unable to change prefix right now. Try again later.');
                     o.complete();
                }
            );    

        });   
    }
}