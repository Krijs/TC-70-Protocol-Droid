import { IBotConfig } from './interfaces/IBotconfig';
import { Config } from './config/config';
import { ITimezoneConfig } from './interfaces/ITimezoneConfig';
import { IIntentHandler } from './interfaces/IIntentHandler';
import { Message, Client } from 'discord.js';
import { MongoClient } from 'mongodb';
import { PingCommand } from './botCommands/pingCommand';
import { IPrefixMap } from './interfaces/IPrefixMap';
import { PrefixCommand } from './botCommands/prefixCommand';
import { ServerPrefixManager } from './serverPrefixManager';
import { Observable } from 'rxjs/Observable';
import { error } from 'util';
import { FriendlyPayoutCommand } from './botCommands/friendlyPayoutCommand';
import { HitlistPayoutCommand } from './botCommands/hitlistPayoutCommand';
import { RotationsCommand } from './botCommands/rotationsCommand';
import { IArenaJumpConfig } from './interfaces/IArenaJumpConfig';
import { ArenaCommand } from './botCommands/arenaCommand';
import { IntentExecutor } from './helpers/intentExecutor';
import { IIntentCollection } from './interfaces/IIntentCollection';
import { TwCommand } from './botCommands/twCommand';
import { GuildCommand } from './botCommands/guildCommand';
import { UnitCommand } from './botCommands/unitCommand';
import { INicknameConfig } from './interfaces/INicknameConfig';
import { ScheduleCommand } from './botCommands/scheduleCommand';
export class Bot {
    private _botConfig = new Config<IBotConfig>('botconfig.json');
    private _timezoneConfig = new Config<ITimezoneConfig>('timezones.json');
    private _arenaJumpConfig = new Config<IArenaJumpConfig>('rankjumps.json');
    private _nicknameConfig = new Config<INicknameConfig>('unit-nicknames.json');
    private _serverPrefixManager = new ServerPrefixManager(this._botConfig.config);

    private intents : IIntentCollection = [
        { handler: new PingCommand(), desc: 'Pings TC-70 to gauge response time' },
        { handler: new PrefixCommand(this._botConfig.config, this._serverPrefixManager), 
          desc: 'Alters the command prefix that TC-70 responds to. Syntax: <prefix>prefix <newPrefix>' },
        { handler: new HitlistPayoutCommand(this._timezoneConfig.config, this._botConfig.config.database), 
          desc: 'Manage the hitlist for the shard. Type <prefix>hitlist ? for more info' },
        { handler: new FriendlyPayoutCommand(this._timezoneConfig.config, this._botConfig.config.database), 
          desc: 'Manage payouts for the shard. Type <prefix>payouts ? for more info' },
        { handler: new RotationsCommand(this._botConfig.config.database), 
          desc: 'Manage rank rotations for payouts. Type <prefix>rotations ? for more info' },
        { handler: new ArenaCommand(this._arenaJumpConfig.config), 
          desc: 'TC-70 will calculate the most efficient arena climb path. Syntax <prefix>arena <startingRank>' },
        { handler: new TwCommand(this._botConfig.config.database, this._nicknameConfig.config), desc: 'View and manage TW defense'},
        { handler: new GuildCommand(this._botConfig.config.database), desc: 'View and manage your guild details'},
        { handler: new UnitCommand(this._botConfig.config.database, this._nicknameConfig.config), desc: 'View and manage SWGOH unit data'},
        { handler: new ScheduleCommand(this._botConfig.config.database, this._nicknameConfig.config), desc: 'Schedule messages to the server'}
      ];

      private _executor : IntentExecutor;

      constructor() {
          this._executor = new IntentExecutor(this.intents, undefined, this._serverPrefixManager);
      }

      public static create() : Bot {
          return new Bot();
      }

      //TODO: Have this shut down nicely if there are errors
      public run() {
        this.connectToDiscord();
      }

      private connectToDiscord() {
        const client = new Client();

        client.on('ready', () => {
             console.log('Successfully connected to Discord');           
        });        
        
        client.on('message', message => {   
            this._executor.tryExecute(message).subscribe(
                foundCommand => { if(foundCommand) message.channel.startTyping(); },
                error =>  {
                    message.channel.stopTyping();
                    message.reply('Sorry, I encountered some issues with that command. Please try again');
                },
                () => {
                    // this._serverPrefixManager.getPrefixes().subscribe(prefixes => {
                    //     console.log(`Prefix for this server: ${prefixes.join('|')}`);
                    // });
                    
                    message.channel.stopTyping();
                }
            );           
        });
        
        client.login(this._botConfig.config.botToken);
      }

      private getServerPrefix(serverId : string) : Observable<string> {
          return Observable.create(o => {
            this._serverPrefixManager.getPrefixes().subscribe(
                prefixes => {
                    let prefixMap = prefixes.find(spm => spm.serverId === serverId);
                    o.next(prefixMap === undefined ? '%' : prefixMap.prefix);
                    o.complete();
                },
                error => {
                    o.error(error);
                    o.complete();
                }
            )
          }); 
      }
}