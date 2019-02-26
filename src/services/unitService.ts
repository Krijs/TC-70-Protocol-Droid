import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { Observable } from 'rxjs/Observable';
import { IGameUnit } from '../interfaces/swgoh.gg/game/IGameUnit';
import { DbConnector } from '../data/dbConnector';
import { PayoutError } from './payoutService';
import { SwgohGGService } from './swgohggService';
import { IUnitMeta } from '../interfaces/IUnitMeta';
import { DateTime, Interval } from 'luxon';
import { IFilteredGameUnit } from '../interfaces/IFilteredGameUnit';
import { INicknameConfig } from '../interfaces/INicknameConfig';
import { Config } from '../config/config';
export class UnitService {
    private _collectionName = 'unitdata';
    private _collectionNameMeta = 'unitmeta';

    private _swgohggService = new SwgohGGService();    

    constructor(private dbCfg : IDatabaseConfig, private nicknameCfg: INicknameConfig) {}

    unitsExist(unitNames: string[]) : Observable<{ unitProvided: string, matchedUnits: IFilteredGameUnit[] }[]> {
        return Observable.create(o => {
            this.getUnitData().subscribe(
                units => {
                    let unitsRet = unitNames.map(un => ({ unitProvided: un, matchedUnits: new Array<IFilteredGameUnit>()}));
                    for(let unitToMatch of unitsRet) {
                        for(let unit of units) {
                            //Exact match
                            if(unit.name.toLowerCase() === unitToMatch.unitProvided.toLowerCase()) {
                                unitToMatch.matchedUnits.push({ unit: unit, exactMatch: true });
                                break; 
                            } else if(unit.name.toLowerCase().indexOf(unitToMatch.unitProvided.toLowerCase()) !== -1) {
                                //Partial match
                                unitToMatch.matchedUnits.push({ unit: unit, exactMatch: false });                              
                            }                             
                        }

                        let nicknameMatches = this.nicknameCfg.dictionary.filter(nn => nn.alternatives.some(
                            a => a.toLowerCase() === unitToMatch.unitProvided.toLowerCase()));

                        //It's possible that we may have assigned the same nickname to many units, in which case
                        //handle gracefully and allow the client to figure out what to do with that information.
                        for(let match of nicknameMatches) {
                            let unit = units.find(u => u.name.toLowerCase() === match.fullName.toLowerCase());
                            if(unit === undefined) continue; //Skip nickname entries where we can't find actual unit data.

                            //Since a nickname is a specified mapping to a fully qualified unit name, we can call this an exact match.
                            unitToMatch.matchedUnits.push({ unit: unit, exactMatch: true });
                        }
                    }

                    o.next(unitsRet);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            )
        });
    }

    getUnits(searchText: string, exactMatch: boolean = false) : Observable<IFilteredGameUnit[]> {
        return Observable.create(o => {
            this.getUnitData().subscribe(
                units => {
                    if(units === undefined || units === null || units.length === 0) {
                        o.next(undefined);
                        o.complete();
                        return;
                    }
                    
                    let searchTextLowered = searchText.toLowerCase();
                    let filteredUnits = units
                        .filter(u =>
                            (exactMatch && u.name.toLowerCase() === searchTextLowered) || 
                            (!exactMatch && (u.name.toLowerCase() === searchTextLowered || 
                                             u.name.toLowerCase().indexOf(searchTextLowered) != -1)))
                        .map(u => <IFilteredGameUnit>({
                            unit: u,
                            exactMatch: u.name.toLowerCase() === searchTextLowered
                        }));

                    o.next(filteredUnits);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
    }

    private getUnitData() : Observable<IGameUnit[]> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }                

                db.collection(this._collectionNameMeta).findOne({},                                       
                    (err, res) =>  {
                        if(err) {
                            o.error(PayoutError.DbOperationFailed);
                            o.complete();
                            return;
                        }                        
                        
                        //No meta info - pull from .gg and store
                        let unitMeta = <IUnitMeta>res;
                        unitMeta = unitMeta === null ? undefined : unitMeta;

                        let lastUpdatedDateTime = unitMeta === undefined ? undefined : DateTime.fromJSDate(unitMeta.lastUpdated);
                        let now = DateTime.local();
                        let diff = unitMeta === undefined ? undefined :  Interval.fromDateTimes(lastUpdatedDateTime, now)
                                        .toDuration('days')
                                        .toObject();

                        if(res === undefined || res === null || diff.days > 3) {                            
                            console.log('syncing from swgoh.gg...');
                            this._swgohggService.getUnits().subscribe(
                                units => {
                                    //Clear existing units
                                    //Insert new ones
                                    //Probably a better way that upserts stuff but I'm not a Mongo Guru.                                    

                                    db.collection(this._collectionName).deleteMany({},
                                        (err, res) =>  {
                                            if(err) {
                                                o.error(PayoutError.DbOperationFailed);
                                                o.complete();
                                                return;
                                            }
                                            
                                            db.collection(this._collectionName).insertMany(units, 
                                                (err, res) =>  {
                                                    if(err) {
                                                        o.error(PayoutError.DbOperationFailed);
                                                        o.complete();
                                                        return;
                                                    }

                                                    //Update the unitmeta
                                                    let meta : IUnitMeta = { lastUpdated: new Date(), id: 'x' };
                                                    db.collection(this._collectionNameMeta).findOneAndUpdate(
                                                        { id: meta.id },
                                                        meta,
                                                        { upsert: true },
                                                        (err, res) => {
                                                        if(err) {
                                                            o.error(PayoutError.DbOperationFailed);
                                                            o.complete();
                                                            return;
                                                        }

                                                        o.next(units);
                                                        o.complete();
                                                    });                                                    
                                                });
                                        });
                                },
                                err => {
                                    o.error(err);
                                    o.complete();
                                }
                            )
                        } else {
                            //Pull from cache
                            db.collection(this._collectionName).find({}).toArray((err, data) => {
                                if(err) {
                                    o.error(PayoutError.DbOperationFailed);
                                    o.complete();
                                    return;
                                }

                                o.next(data);
                                o.complete();
                            });                            
                        }                       
                    }
                );
            });
        });
    }
}