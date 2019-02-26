import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { IGuildMeta } from '../interfaces/IGuildMeta';
import { DbConnector } from '../data/dbConnector';
import { Observable } from 'rxjs/Observable';
import { PayoutError } from './payoutService';
import { IGuild } from '../interfaces/swgoh.gg/guild/IGuild';
import { IGuildCache } from '../interfaces/IGuildCache';
export class GuildService {
    private _collectionNameMeta = 'guildmeta';
    private _collectionNameCache = 'guilddata';
    constructor(private dbCfg: IDatabaseConfig) {}

    registerGuild(guild: IGuildMeta) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }                

                db.collection(this._collectionNameMeta).findOneAndUpdate(
                    { serverId : guild.serverId },
                    guild,
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

    cacheGuild(serverId: string, guild: IGuild) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }                

                let cache : IGuildCache = {
                    serverId: serverId,
                    guild: guild
                };

                db.collection(this._collectionNameCache).findOneAndUpdate(
                    { serverId : cache.serverId },
                    cache,
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

    getCachedGuildData(serverId: string) : Observable<IGuild> {
        //We can get data based on server ID, since only one guild can be registered to a server.
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }                

                db.collection(this._collectionNameCache).findOne(
                    { serverId : serverId },                    
                    (err, res) =>  {
                        if(err) {
                            o.error(PayoutError.DbOperationFailed);
                            o.complete();
                            return;
                        } 

                        let cache = <IGuildCache>res;
                        o.next(cache.guild);
                        o.complete();
                    }
                );
            });
        });
    }
}