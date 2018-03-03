import { DateTime } from 'luxon';
import { IRotatingPlayer } from './IRotatingPlayer';
export interface IRankRotation {
    players : string[];
    ranks : number[];

    payoutTime? : string;
    payoutTimezoneUTC? : string;

    rotationStarted? : string;
    serverId: string;
}