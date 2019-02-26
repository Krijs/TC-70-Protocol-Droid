import { IBreakString, CheckType } from '../interfaces/IBreakString';
export class DelimitedArrayParser {
    delimeter = ',';

    constructor(delimeter? : string) {
        if(delimeter !== undefined) this.delimeter = delimeter;
    }

    parse(arr : string[], breakStrings : IBreakString[] = []) : { parsedItems: string[], brokenAt? : number } {
        let items : { parsedItems: string[], brokenAt? : number } = { parsedItems: [] };

        let parsingItem = false;
        let itemsParsed = 0;
        for(let item of arr) {
            for(let bs of breakStrings) {
                if((bs.checkType === CheckType.AtStart && item.startsWith(bs.str)) ||
                (bs.checkType === CheckType.Equals && item === bs.str) ||
                (bs.checkType === CheckType.AtEnd && item.endsWith(bs.str))) {
                    items.brokenAt = itemsParsed;
                    return items;
                }                 
            }

            if(parsingItem) {
                items.parsedItems[items.parsedItems.length -1] += ` ${this.cleanString(item)}`;
            } else {
                items.parsedItems.push(this.cleanString(item));
            }

            parsingItem = !item.endsWith(',');
            itemsParsed++;
        }

        return items;
    }

    private cleanString(text : string) : string {
        return text.replace('~', '').replace('[','').replace(']','').replace('<','').replace('>','').replace(',','');
    }
}