export interface ITerritoryTeamUnit {
    unitName : string;
    zetasRequired?: string[];
    isReplaceable: boolean;
    isReserve?: boolean;
    isLeader?: boolean;
    minimumGearTier?: number;
}