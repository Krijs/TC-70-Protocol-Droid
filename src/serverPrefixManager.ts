import { IPrefixMap } from './interfaces/IPrefixMap';
import { IBotConfig } from "./interfaces/IBotconfig";
import { Observable } from "rxjs/Observable";
import { MongoClient } from 'mongodb';

export class ServerPrefixManager {  
    private _serverPrefixes : IPrefixMap[];

    constructor(private botConfig :IBotConfig) {}

    getPrefixes() : Observable<IPrefixMap[]> {
        return Observable.create(o => {
            if(this._serverPrefixes !== undefined) {
                o.next(this._serverPrefixes);
                o.complete();
                return;
            }

            MongoClient.connect(this.botConfig.database.url, (err, client) => {  
                if(err) {
                    console.log('Cannot connect to database. Check details are corrext.');
                    return;
                }
                
                //console.log("Connected successfully to database");   
                const db = client.db(this.botConfig.database.name);
            
                db.collection('server-prefixes')
                .find()
                .toArray((err, res : IPrefixMap[]) => {
                    if(err) {
                        o.error(err);
                        o.complete();
                        return;
                    }

                    this._serverPrefixes = res;
                    o.next(this._serverPrefixes);
                    o.complete();
                });
            
                client.close();
            });
        });
    }

    addOrUpdatePrefix(prefixMap : IPrefixMap) : Observable<boolean> {
        return Observable.create(o => {
            MongoClient.connect(this.botConfig.database.url, (err, client) => {
                const db = client.db(this.botConfig.database.name);
                db.collection('server-prefixes')
                  .findOneAndUpdate(
                    { serverId: prefixMap.serverId }, 
                    prefixMap,
                    { upsert: true}, 
                    (err, data) => {
                        if(err) {
                            o.next(false);
                            o.complete();
                            return;
                        }

                        if(this._serverPrefixes === undefined) this._serverPrefixes = [];

                        let existingPrefix = this._serverPrefixes.find(p => p.serverId === prefixMap.serverId);
                        //Add/update locally
                        if(existingPrefix === undefined)
                            this._serverPrefixes.push(prefixMap);
                        else
                            existingPrefix.prefix = prefixMap.prefix;
                        
                        o.next(true);
                        o.complete();
                    }
                 );
            });
        })
    }
}