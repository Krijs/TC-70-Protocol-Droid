import { IIntentHandler } from "../interfaces/IIntentHandler";
import { Message, RichEmbed } from 'discord.js';
import { Observable } from 'rxjs/Observable';
import { MaxRankCalculator } from '../helpers/maxRankCalculator';
import { IArenaJumpConfig } from '../interfaces/IArenaJumpConfig';

export class ArenaCommand implements IIntentHandler {
    intent: string | string[] = 'arena';

    constructor(private arenaJumpConfig : IArenaJumpConfig) {}

    execute(m: Message, params: string[]) : Observable<boolean> {
        return Observable.create(o => {
            let startingRank : number;
            if(params.length === 0 || isNaN((startingRank = Number(params[0])))) {
                m.reply('Please provide a starting rank.');
                o.complete();
                return;
            }

            let calc = new MaxRankCalculator(this.arenaJumpConfig);
            let jumps = calc.calculateBestPath(startingRank);

            let embed = new RichEmbed();
            embed.setThumbnail('https://i.imgur.com/USdSyQ7.png')
                 .addField(`From rank ${startingRank} without refreshing`, 
                    jumps.map(r => r.toString()).reduce((a,b) => `${a} > ${b}`));
            
            m.channel.send({embed});
            o.complete();
        });
    }
    
}