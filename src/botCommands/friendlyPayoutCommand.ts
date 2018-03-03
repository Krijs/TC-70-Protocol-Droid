import { HitlistPayoutCommand } from './hitlistPayoutCommand';
import { ITimezoneConfig } from '../interfaces/ITimezoneConfig';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { PayoutType, PayoutService, PayoutError } from '../services/payoutService';
import { Message } from 'discord.js';
import { Observable } from 'rxjs/Observable';
import { IRankRotation } from '../interfaces/IRankRotation';
import { DateTime } from 'luxon';
import { IRotatingPlayer } from '../interfaces/IRotatingPlayer';
import { DbConnector } from '../data/dbConnector';
import { error } from 'util';
export class FriendlyPayoutCommand extends HitlistPayoutCommand {
    public intent = 'payouts';

    protected payoutType : PayoutType = PayoutType.Friendly;

    constructor(protected timezones : ITimezoneConfig, protected dbCfg : IDatabaseConfig) { 
        super(timezones, dbCfg);
        //Just setting the payoutType doesn't seem to work here, so have to re-init the service
        this._payoutService = new PayoutService(this.payoutType, this.dbCfg);
    }    
}