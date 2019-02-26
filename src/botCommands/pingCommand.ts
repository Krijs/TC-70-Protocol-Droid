import { IIntentHandler } from '../interfaces/IIntentHandler';
import { Message } from 'discord.js';
import { Observable } from 'rxjs/Observable';
import { DateTime, Interval } from 'luxon';

export class PingCommand implements IIntentHandler {
    intent: string = 'ping';
    intentDepth = 0;

    execute(m: Message, params: any[]) : Observable<boolean> {
        return Observable.create(o => {
            let createdDateTime = DateTime.fromJSDate(m.createdAt);
            let now = DateTime.local();
            let diff = Interval.fromDateTimes(createdDateTime, now)
                               .toDuration('milliseconds')
                               .toObject();
            

            m.reply(`Hello, I am TC-70. My response time is ${diff.milliseconds||0}ms.`);
            o.complete();
        });
    }
}