import { Message } from "discord.js";
import { Observable } from 'rxjs/Observable';

export interface IIntentHandler {
    intent: string | string[];
    execute: (m : Message, params : any[]) => Observable<boolean>;
}