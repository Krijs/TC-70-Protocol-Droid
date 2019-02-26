import { ITerritoryTeam } from '../interfaces/ITerritoryTeam';
import { Observable } from 'rxjs/Observable';
import { of } from 'rxjs/observable/of';
import { IDatabaseConfig } from '../interfaces/IDatabaseConfig';
import { ITwConfig } from '../interfaces/ITwConfig';
import { DbConnector } from '../data/dbConnector';
import { PayoutError } from './payoutService';
import { IServerTwConfig } from '../interfaces/IServerTwConfig';
import { error } from 'util';
import { IMatchedTeam } from '../interfaces/IMatchedTeam';
import { IFlattenedPlayerTeam } from '../interfaces/IFlattenedPlayerTeam';
import { IServerMatchedTeam } from '../interfaces/IServerMatchedTeam';
let util = require('util');

export class TwService {   
    private _collectionName = 'twconfig';
    private _collectionAssignments = 'twassignments';

    constructor(private dbCfg : IDatabaseConfig) {}

    getAssignedPlayerTeams(serverId : string, territory? : string) : Observable<Map<string, IMatchedTeam[]>> {
        return Observable.create(o => {
            //TODO: pull from twassignments
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }  
                
                let territoryFilter = territory === undefined ? {} : { territory: territory };

                db.collection(this._collectionAssignments)
                    .find<IServerMatchedTeam>({ serverId: serverId })
                    .filter({ territory: territory })                 
                    .toArray((err, data) => {
                        if(err) {
                            o.error();
                            o.complete();
                            return;
                        }  

                        
                    });
            });
        });
    }
    
    assignPlayerTeams(serverId: string, teams: IMatchedTeam[]) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }    
                
                let serverTeams = teams.map(t => {
                    let serverTeam = <IServerMatchedTeam>t;
                    serverTeam.serverId = serverId;
                    return serverTeam;
                });

                db.collection(this._collectionAssignments).insertMany(
                    serverTeams,                    
                    (err, res) =>  {
                        if(err) {
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

    setMinGearRequirement(serverId: string, gear: number) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    cfg.minimumGearRequirement = gear;
                    this.saveTwConfig({ serverId:serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });
    }
    setDefensiveSlots(serverId: string, slots: number) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    cfg.defensiveSlots = slots;
                    this.saveTwConfig({ serverId:serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });
    }

    setExcludedPlayers(serverId: string, players: string[], flags: string[]) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    cfg.excludedPlayers = flags.some(f => f.toLowerCase() === '--clear') ? [] : players;
                    this.saveTwConfig({ serverId:serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });
    }

    allocateTeam(serverId: string, teamName : string, territory : string) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    if(cfg === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }

                    if(cfg.pool === undefined) cfg.pool = [];
                    let team = cfg.pool.find(t => t.name.toLowerCase() === teamName.toLowerCase());
                    if(team === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }                    
                    
                    //Clone team object
                    let teamClone = {};
                    Object.assign(teamClone, team);
                    (<ITerritoryTeam>teamClone).territory = territory; //Assign territory

                    cfg.teams.push(<ITerritoryTeam>teamClone);
                    this.saveTwConfig({ serverId: serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
    }

    deallocateTeam(serverId: string, teamName : string, territory : string) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    if(cfg === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }

                    let team = cfg.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase() &&
                         t.territory.toLowerCase() === territory.toLowerCase());

                    if(team === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }

                    cfg.teams = cfg.teams.filter(t => t !== team); //Remove team                   
                    this.saveTwConfig({ serverId: serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
    }


    clearTerritory(serverId : string, territory: string) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    if(cfg === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }

                    cfg.teams = cfg.teams.filter(t => t.territory.toLowerCase() !== territory.toLowerCase());
                    this.saveTwConfig({ serverId: serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
    }

    addTeam(serverId: string, team : ITerritoryTeam) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    if(cfg === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }
                    
                    if(cfg.pool === undefined) cfg.pool = [];
                    cfg.pool.push(team);
                    this.saveTwConfig({ serverId: serverId, config: cfg }).subscribe(
                        success => {
                            o.next(true);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
    }

    viewPool(serverId: string) : Observable<ITerritoryTeam[]> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    o.next(cfg.pool);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });    
    }

    getTeams(serverId: string) : Observable<ITerritoryTeam[]> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    o.next(cfg.teams);
                    o.complete();
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
    }

    removeTeam(serverId: string, teamName: string) : Observable<boolean> {
        return Observable.create(o => {
            this.getTwConfig(serverId).subscribe(
                cfg => {
                    let team = cfg.pool.find(t => t.name.toLowerCase() === teamName.toLowerCase());
                    if(team === undefined) {
                        o.next(false);
                        o.complete();
                        return;
                    }

                    if(cfg.pool === undefined) cfg.pool = [];
                    cfg.pool = cfg.pool.filter(t => t !== team);
                    this.saveTwConfig({ serverId: serverId, config: cfg }).subscribe(
                        success => {
                            o.next(success);
                            o.complete();
                        },
                        err => {
                            o.error(err);
                            o.complete();
                        }
                    )
                },
                err => {
                    o.error(err);
                    o.complete();
                }
            );
        });        
        
    }

    setupTw(serverId: string, config: ITwConfig) : Observable<boolean> {
        let serverTwConfig :IServerTwConfig = {
            serverId: serverId,
            config: config
        };

       return this.saveTwConfig(serverTwConfig);
    }

    getTwConfig(serverId: string) : Observable<ITwConfig> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }                

                db.collection(this._collectionName).findOne(
                    { serverId : serverId },                    
                    (err, res) =>  {
                        if(err) {
                            o.error(PayoutError.DbOperationFailed);
                            o.complete();
                            return;
                        } 
                                                
                        o.next(res === null ? undefined : (<IServerTwConfig>res).config);
                        o.complete();
                    }
                );
            });
        });
    }

    private saveTwConfig(config : IServerTwConfig) : Observable<boolean> {
        return Observable.create(o => {
            let dbc = new DbConnector(this.dbCfg);
            dbc.connect((err, db) => {
                if(err) {
                    o.error();
                    o.complete();
                    return;
                }                   

                db.collection(this._collectionName).findOneAndUpdate(
                    { serverId : config.serverId },
                    config,
                    { upsert: true },                    
                    (err, res) =>  {
                        if(err) {
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
}