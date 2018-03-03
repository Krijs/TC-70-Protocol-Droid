import { MongoClient, MongoError, Db } from 'mongodb';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
export class DbConnector {
    constructor(private dbCfg : IDatabaseConfig) {}

    public connect(cb : (err : MongoError, db : Db)) {
        MongoClient.connect(this.dbCfg.url, (err, client) => {
            let db = err ? undefined : client.db(this.dbCfg.name);
            cb(err, db);
        });
    }
}