import { Observable } from 'rxjs/Observable';
import { IGuild } from '../interfaces/swgoh.gg/guild/IGuild';
import { IGuildData } from '../interfaces/swgoh.gg/IGuildData';
import { IGameUnit } from '../interfaces/swgoh.gg/game/IGameUnit';
let http = require('https');
const request = require('request');


export class SwgohGGService {
    constructor(private _url : string = 'https://swgoh.gg/api') {}

    getUnits() : Observable<IGameUnit[]> {
        return Observable.create(o => {
            var options = {
                uri : `${this._url}/characters`,
                method : 'GET'
            }; 

            request(options, (err, res, body) => {
                const { statusCode } = res;
                const contentType = res.headers['content-type'];

                let error;
                if (statusCode !== 200) {
                    error = new Error('Request Failed.\n' +
                                    `Status Code: ${statusCode}`);
                } else if (!/^application\/json/.test(contentType)) {
                    error = new Error('Invalid content-type.\n' +
                                    `Expected application/json but received ${contentType}`);
                }
                if (err || error) {
                    console.error(err || error.message);                   
                    o.error(err || error);
                    o.complete();
                    return;
                }
                
                try {
                    let guildData = <IGameUnit[]>JSON.parse(body);
                    o.next(guildData);
                    o.complete();
                } catch (e) {
                    o.error(e);
                    o.complete();
                }        
            });           
        });
    }
    getGuildDetails(guildId: number) : Observable<IGuild> {
        return Observable.create(o => {
            var options = {
                uri : `${this._url}/guild/${guildId}`,
                method : 'GET'
            }; 
            request(options, (err, res, body) => {
                const { statusCode } = res;
                const contentType = res.headers['content-type'];

                let error;
                if (statusCode !== 200) {
                    error = new Error('Request Failed.\n' +
                                    `Status Code: ${statusCode}`);
                } else if (!/^application\/json/.test(contentType)) {
                    error = new Error('Invalid content-type.\n' +
                                    `Expected application/json but received ${contentType}`);
                }
                if (err || error) {
                    console.error(err || error.message);                   
                    o.error(err || error);
                    o.complete();
                    return;
                }

                try {
                    let guildData = <IGuild>JSON.parse(body);
                    o.next(guildData);
                    o.complete();
                } catch (e) {
                    o.error(e);
                    o.complete();
                }        
            });           
        });
    }
}