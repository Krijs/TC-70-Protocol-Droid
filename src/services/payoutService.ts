import { IPayout } from '../interfaces/IPayout';
import { Observable } from "rxjs/Observable";
import { DbConnector } from '../data/dbConnector';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { PayoutHelper } from '../helpers/PayoutHelper';
import { DateTime } from 'luxon';
import { error } from 'util';

export class PayoutService {
    private _collectionName : string;
    constructor(private payoutType : PayoutType, private dbCfg : IDatabaseConfig) {
        this._collectionName = payoutType === PayoutType.Friendly ? 'payouts' : 'hitlist';
    }

    public getPayouts(serverId : string) : Observable<IPayout[]> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }

                db.collection(this._collectionName)
                  .find({ serverId: serverId })
                  .toArray((err, items) => {
                    if(err) {
                        o.error();
                        o.complete();
                        return;
                    }

                    o.next(items);
                    o.complete();
                  });
            });
        });
    }

    public addPayout(payout : IPayout) : Observable<boolean> {
        return Observable.create(o => {
            if(!payout || !payout.name || !payout.time || !payout.timezone){
                o.error(PayoutError.InvalidPayout);
                o.complete();
                return;
            }
            
            let tz = DateTime.local().setZone(payout.timezoneUTC);
            if(!tz.isValid) {
               o.error(PayoutError.InvalidTimezone);
               o.complete();
               return;
            }
    
            //Insert payout into db
            this.insertPayoutIntoDb(payout)
                .subscribe(
                    success =>{
                         o.next(true);
                        o.complete();
                    },
                    error => {
                         o.error(error);
                         o.complete();
                    });

        });
    }

    public removePayout(name : string, serverId : string) : Observable<boolean> {
        return Observable.create(o => {
            if(!name){
                o.error(PayoutError.InvalidParameter);
                o.complete();
                return;
            }

            this.removePayoutFromDbByName(name, serverId).subscribe(
                success => {
                    o.next(true);
                    o.complete();
                },
                error => { 
                    o.error(error);
                    o.complete();
                });
        });
    }

    public clearPayouts(serverId : string) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error(PayoutError.DbConnectionFailed);
                    o.complete();
                    return;
                }

                db.collection(this._collectionName).deleteMany({ serverId: serverId }, (err, res) => {
                    if(err) {
                        o.error(PayoutError.DbOperationFailed);
                        o.complete();
                        return;
                    }

                    o.next(true);
                    o.complete();
                });
            });
        });
    }

    private insertPayoutIntoDb(payout : IPayout) : Observable<boolean> {
        return Observable.create(o => { 
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error(PayoutError.DbConnectionFailed);
                    o.complete();
                    return;
                }

                db.collection(this._collectionName).findOneAndUpdate(
                    { serverId : payout.serverId, name: payout.name },
                    payout,
                    { upsert: true },
                    (insertErr, res) =>  {
                        if(insertErr) {
                            o.error(PayoutError.DbOperationFailed);
                            o.complete();
                            return;
                        } 

                        o.next(true);
                        o.complete();
                    }
                );
            });
        });
    }

    private removePayoutFromDbByName(name : string, serverId : string) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error(PayoutError.DbConnectionFailed);
                    o.complete();
                    return;
                }

                db.collection(this._collectionName).findOneAndDelete(
                    { serverId : serverId, name : name },
                    (err, res) => {
                        if(err) {
                            o.error(PayoutError.DbOperationFailed);
                            o.complete();
                            return;
                        }

                        o.next(true);
                        o.complete();
                    }
                )
            });
        });
    }

}

export enum PayoutType {
    Friendly,
    Foe
}

export enum PayoutError {
    InvalidParameter,
    InvalidPayout,
    InvalidTimezone,
    DbConnectionFailed,
    DbOperationFailed
}