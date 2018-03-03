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
export class Bot {
    private _botConfig = new Config<IBotConfig>('botconfig.json');
    private _timezoneConfig = new Config<ITimezoneConfig>('timezones.json');
    private _serverPrefixManager = new ServerPrefixManager(this._botConfig.config);

    private intents : IIntentHandler[] = [
        new PingCommand(),
       // new PayoutsCommand(this._timezoneConfig.config, this._botConfig.config.database),
        new PrefixCommand(this._botConfig.config, this._serverPrefixManager),
        new HitlistPayoutCommand(this._timezoneConfig.config, this._botConfig.config.database),
        new FriendlyPayoutCommand(this._timezoneConfig.config, this._botConfig.config.database),
        new RotationsCommand(this._botConfig.config.database)
      ];

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
            this.getServerPrefix(message.guild.id).subscribe(
                prefix => {
                    if(!message.content.startsWith(prefix)) return;
            
                    //Parse intent and trailing parameters
                    let splitContent = message.content.substring(prefix.length).split(' ');
                    let intent = splitContent[0];
                    let params = splitContent.slice(1);
                    
                    //Find intent and if it exists, execute it
                    let matchedintent = this.intents.find(cmd => cmd.intent === intent);
                    if(matchedintent === undefined) return;
                    
                    try {
                        message.channel.startTyping();
                        matchedintent.execute(message, params).subscribe(
                            null,
                            error => {
                                message.channel.stopTyping();
                                message.reply('Rarggghh! Sorry, I encountered some issues with that command. Please try again');
                            },
                            () => {
                                message.channel.stopTyping();
                            }
                        );
                    } catch (error) {
                        console.error(error);
                        message.reply('Rarggghh! Sorry, I encountered some issues with that command. Please try again');
                    }
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