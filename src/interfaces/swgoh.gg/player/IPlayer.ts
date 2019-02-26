import { IUnit } from './IUnit';
import { IPlayerData } from './IPlayerData';
export interface IPlayer {
    units: IUnit[];
    data: IPlayerData;
}