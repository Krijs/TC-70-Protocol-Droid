import { IGameUnit } from './swgoh.gg/game/IGameUnit';
export interface IFilteredGameUnit {
    unit: IGameUnit;
    exactMatch: boolean;    
}