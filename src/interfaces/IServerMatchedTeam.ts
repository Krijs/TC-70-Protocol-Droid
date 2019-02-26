import { IMatchedTeam } from "./IMatchedTeam";

export interface IServerMatchedTeam extends IMatchedTeam {
    serverId: string;
}