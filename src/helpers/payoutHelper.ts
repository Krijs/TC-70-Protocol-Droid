import { ITimezoneConfig } from '../interfaces/ITimezoneConfig';
import { IPayout } from '../interfaces/IPayout';
import { ITime } from '../interfaces/ITime';
import { DateTime, Interval } from 'luxon';

export class PayoutHelper {
    public static buildPayoutFromParams(params : string[], serverId : string, timezones : ITimezoneConfig) {
        let payout : IPayout = {
            name: params.length > 0 ? params[0] : undefined,
            time: params.length > 1 ? params[1] : undefined, 
            emoji: params.length > 3 ? params[3] : undefined,
            serverId: serverId
        };

        if(params.length > 2) {
            let tzParam = params[2].toUpperCase();
            let isUTC = tzParam.match(/^utc\s?(\+|\-){1}\s?\d+$/i);

            if(isUTC) {
                payout.timezone = tzParam;
                payout.timezoneUTC = tzParam;
            } else {
                let timezone = timezones.Timezones.find(tz => tz.Alias.toUpperCase() === tzParam);

                if(timezone) {
                    payout.timezone = timezone.Alias;
                    payout.timezoneUTC = timezone.UTCOffset;
                }
            }
        }

        return payout;
    }

    public static calculateTimeToPayout(payout : IPayout) : ITime {
        //Switch to current payout group's timezone
        let payoutTimeParsed = payout.time.split(':').map(seg => seg === '00' ? 0 : parseInt(seg));
        let payoutTime = DateTime.local().setZone(payout.timezoneUTC || payout.timezone)
                                 .set({ hour: payoutTimeParsed[0], minute: payoutTimeParsed[1]});
        let currentTime = DateTime.local().setZone(payout.timezoneUTC || payout.timezone);

        //If we've missed the payout, adjust the object so we can calculate against tomorrow's payout
        if(currentTime > payoutTime) payoutTime = payoutTime.plus({days: 1});

        //Calculate diff between now and payout
        let time : ITime =
         Interval.fromDateTimes(currentTime, payoutTime)
                           .toDuration(['hours', 'minutes'])
                           .toObject();
        time.minutes = Math.round(time.minutes);

        return time;
    }
}