import { IPlayer } from '../player/IPlayer';
import { IGuildData } from './IGuildData';
export interface IGuild {
    players: IPlayer[];
    data: IGuildData;
}