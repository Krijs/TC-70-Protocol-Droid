export interface IBreakString {
    str: string;
    checkType: CheckType;
}

export enum CheckType {
    AtStart,
    Equals,
    AtEnd
}