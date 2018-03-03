import { ITime } from "./ITime";

export interface IPayout {
    serverId? : string;
    name? : string;
    time? : string;
    timezone? : string;
    timezoneUTC? : string;
    emoji? : string;
    timeToPayout?: ITime;
}