import { IIntentHandler } from '../interfaces/IIntentHandler';
import { Message } from 'discord.js';
import { Observable } from 'rxjs/Observable';

export class PingCommand implements IIntentHandler {
    intent: string = 'ping';

    execute(m: Message, params: any[]) : Observable<boolean> {
        return Observable.create(o => {
            m.reply('Womp!');
            o.complete();
        });
    }
}