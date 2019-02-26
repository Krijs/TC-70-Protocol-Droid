import { IGameUnitGearLevel } from './IGameUnitGearLevel';
export interface IGameUnit {
    name: string;
    base_id: string;
    pk: number;
    url: string;
    image: string;
    power: number;
    description: string;
    combat_type: number;
    gear_levels: IGameUnitGearLevel[];
    alignment: string;
    categories: string[];
    ability_classes: string[];
    role: string;
    ship: string;
    ship_slot: string;
    activate_shard_count: string;    
}