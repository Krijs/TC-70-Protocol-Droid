import * as fs from 'fs';
export class Config<T> {
    private _config : T;
    get config() : T{
        if(this._config === undefined)
            this._config = JSON.parse(fs.readFileSync(this._path, 'utf8'));

        return this._config;
    }

    
    private _path : string;

    constructor(path : string) {
        this._path = path;
    }
}