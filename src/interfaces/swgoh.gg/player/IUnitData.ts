import { IUnitGearSlot } from '../IUnitGearSlot';
import { IUnitAbility } from '../IUnitAbility';
export interface IUnitData {
    gear_level: number;
    gear: IUnitGearSlot[];
    power: number;
    level: number;
    url: string;
    combat_type: number;
    rarity: number;
    base_id: string;
    stats: {};
    zeta_abilities: string[]; //string array of ability IDs
    ability_data: IUnitAbility[];
    name: string;

}