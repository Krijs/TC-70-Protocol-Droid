import { IArenaJumpConfig } from '../interfaces/IArenaJumpConfig';
export class MaxRankCalculator {
    constructor(private arenaJumpConfig : IArenaJumpConfig) {}

    public calculateBestPath(startingRank : number, maxAttempts : number = 5) {
        let maxKnownRank = this.getMaxKnownRank();
        if(startingRank > maxKnownRank) throw new RangeError();

        let currentRank = startingRank;
        let rankPath : number[] = [];

        //Not the most efficient way of traversing the jump config, but 
        //we're only dealing with a handful of items anyway
        while(currentRank > 1 && (rankPath.length < maxAttempts || maxAttempts === -1)) {            
            for(let jump of this.arenaJumpConfig.jumps) {
                if(currentRank > jump.from || currentRank < jump.to) continue;
                rankPath.push(currentRank -= jump.maxJump);
                break;
            }
        }

        //Add original rank to the start of the rank path
        rankPath.splice(0, 0, startingRank);
        return rankPath;
    }

    private getMaxKnownRank() : number {
        let first = this.arenaJumpConfig.jumps.sort((a, b) => {

            if(a.from < b.from || !a) return 1;
            if(a.from > b.from || !b) return -1;

            return 0;
        })[0];

        return first.from;
    }
}