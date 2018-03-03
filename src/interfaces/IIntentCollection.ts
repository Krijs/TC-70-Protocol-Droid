import { IIntentHandler } from './IIntentHandler';
export interface IIntentCollection extends Array<{handler: IIntentHandler, default? : boolean, desc : string}> {

}