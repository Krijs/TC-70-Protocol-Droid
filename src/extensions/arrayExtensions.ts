export class ArrayExtensions {
    public static groupBy<T, TKey>(list : T[], keyGetter : (obj : T) => TKey) {
        const map = new Map<TKey, T[]>();
        list.forEach((item) => {
            const key = keyGetter(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            } else {
                collection.push(item);
            }
        });
        return map;
    }

    public static isUndefinedNullOrEmpty(arr: any[]) : boolean {
        return arr === undefined || arr === null || arr.length === 0;
    }

}