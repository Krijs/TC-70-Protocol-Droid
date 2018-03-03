import { Observable } from 'rxjs/Observable';
import { ServerPrefixManager } from '../serverPrefixManager';
import { IIntentCollection } from '../interfaces/IIntentCollection';
import { Message, RichEmbed } from 'discord.js';
import { Observer } from 'rxjs/Observer';
export class IntentExecutor {

    constructor(private intents : IIntentCollection, private intent? : string | string[],
                private prefixManager? : ServerPrefixManager) {
        //Add 'help' intent
        if(!intents || intents.find(i => i.handler.intent === '?')) return;

        intents.push({
            handler: {
                intent: '?',
                execute: (message, params) => this.showHelp(message)
            },
            desc: `Shows help ${this.intent ? 'for ' :''}${this.intent||''}. Syntax: ${this.intent || ''} ?`
        });
    }

    setDefaultHandler(func : (m:Message, params:any[]) => Observable<boolean>, desc : string) {
        this.intents.push({
            handler: {
                intent: '',
                execute: func
            },
            desc: desc,
            default: true
        });
    }

    tryExecute(message : Message) : Observable<boolean> {
        return Observable.create(o => {
            if(this.prefixManager === undefined) {
                this.parseIntent(message, o);
            } else {
                this.getServerPrefix(message.guild.id).subscribe(
                    prefix => {
                        if(!message.content.startsWith(prefix)) {
                            o.complete();
                            return;
                        };
                
                        this.parseIntent(message, o, prefix);
                    },
                    error => {
                        o.error(error);
                        o.complete();
                    }
                );
            }
        });
    }

    protected showHelp(m:Message) : Observable<boolean> {
        return Observable.create(o => {
            // let response : string[] = [];
            // response.push('Here is some help for this intent:\r\n');
            // response = response.concat(this.intents.map(i => `**${i.handler.intent}**: ${i.desc}\r\n`));

            // m.reply(response.join('\r\n'));
            let embed = new RichEmbed();
            embed.setTitle('TC-70 Instruction Manual')
                 .setThumbnail('https://i.imgur.com/wuLq627.png')
                 .setDescription(this.intent ?
                    `Here is some help for *${this.intent}*` 
                    : 'Here are the commands I can compute:');
            
            this.intents.forEach((item, idx) => {
                embed.addField(item.handler.intent.length === 0 ? '<no params>' : item.handler.intent, item.desc);
            });
            m.channel.send({embed});

            o.complete();
        });
    }

    private parseIntent(message : Message, o : Observer<boolean>, prefix? : string) {
        //Parse intent and trailing parameters
        let splitContent = (prefix ? message.content.substring(prefix.length) : message.content).split(' ');
        let intent = splitContent[prefix ? 0 : 1];
        let params = splitContent.slice(prefix ? 1 : 2);
        
        //Find intent and if it exists, execute it
        let matchedintent = this.intents.find(cmd => cmd.handler.intent === intent)
            || this.intents.find(cmd => cmd.default);
        if(matchedintent === undefined) {
            o.complete();
            return;
        }
        
        o.next(true); //Signal that we've matched a command
        matchedintent.handler.execute(message, params).subscribe(
            null,
            error => {
                o.error(error);
                o.complete();
            },
            () => {
                o.complete();
            }
        );
    }

    private getServerPrefix(serverId : string) : Observable<string> {
        return Observable.create(o => {
          this.prefixManager.getPrefixes().subscribe(
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
