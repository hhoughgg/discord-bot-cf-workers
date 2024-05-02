import { DurableObject } from "cloudflare:workers";
import { InteractionType, InteractionResponseType, InteractionResponseFlags, verifyKey } from "discord-interactions";
import { InteractionRequest } from './commands'

export type Env = {
  APP_PUBLIC_KEY: string
  APP_ID: string
  TOKEN: string
  GUILDS: DurableObjectNamespace<Guild>
  AI: any
  DB: D1Database
}

// Worker
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/api/interactions":
        const rawBody = await request.clone().arrayBuffer()
        const json: InteractionRequest = await request.json()
        const signature = request.headers.get('X-Signature-Ed25519') || "";
        const timestamp = request.headers.get('X-Signature-Timestamp') || "";
        const isValidRequest = verifyKey(rawBody, signature, timestamp, env.APP_PUBLIC_KEY);
        if (!isValidRequest) {
          return new Response("Bad Request Signature", { status: 401 })
        }

        if (json.type === InteractionType.PING) {
          // The `PING` message is used during the initial webhook handshake, and is
          // required to configure the webhook in the developer portal.
          return new Response(JSON.stringify({
            type: InteractionResponseType.PONG,
          }));
        } else if (json.type === InteractionType.APPLICATION_COMMAND) {
          if (json.guild_id === undefined) {
            return new Response("Unsupported Interaction", { status: 501 });
          } else {
            // need to be able to scale our stateful bot - lets create a durable object per discord server (guild)
            // TODO handle commands with no guild
            const id = env.GUILDS.idFromName(json.guild_id)
            const stub = env.GUILDS.get(id)
            const headers = new Headers
            headers.set('Content-Type', 'application/json')

            switch (json.data?.name.toLowerCase()) {
              case "ping":
                return await stub.ping()
              case "question":
                ctx.waitUntil(stub.question(json.data?.options[0].value, json))

                return new Response(
                  JSON.stringify({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                  }), { headers: headers },
                );
              default:
                return new Response('Unknown Application Command', { status: 400 });
            }
          }
        } else {
          return new Response("Unsupported Interaction", { status: 501 });
        }
      default:
        return new Response("Not found", { status: 404 });
    }
  }
};

// Durable Object
export class Guild extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
  }

  ping() {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "pong",
          flags: InteractionResponseFlags.EPHEMERAL,
        }
      }),
    );
  }

  async question(value: string, req: InteractionRequest) {
    let questions: number = (await this.ctx.storage.get(req.member.user.global_name)) || 0;
    questions += 1
    await this.ctx.storage.put(req.member.user.global_name, questions);

    let prompt = `the user asking you a question is ${req.member.user.global_name} and they have asked ${questions} question(s)\n`
    prompt += SYSTEM_PROMPT

    try {
      const inference = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: value },
        ],
      })

      return fetch(`https://discord.com/api/v10/webhooks/${req.application_id}/${req.token}/messages/@original`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${this.env.TOKEN}`
        },
        method: 'PATCH',
        body: JSON.stringify({ content: inference.response }),
      })
    } catch (err) {
      return fetch(`https://discord.com/api/v10/webhooks/${req.application_id}/${req.token}/messages/@original`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${this.env.TOKEN}`
        },
        method: 'PATCH',
        body: JSON.stringify({ content: err }),
      })
    }
  }
}

const SYSTEM_PROMPT = `
  You are a grumpy gamer. You don't really want to help people that much and are just as likely to lightly troll or roast someone than have a useful answer to the question. 
  Sometimes you may even be in game and too busy to answer the question. You are completely deluded into thinking you are one of the worlds best gamers but are held back by
  ranking systems created by people who don't understand your true brilliance and match you with teammates who are terrible to keep you away from the rank you truly deserve.
  In CS2 you are rated 694 which is in the bottom one percent but you instead took it to mean you are a 1% gamer. You will take every opportunity to profess your genius and gaming skills.
  Shroud - the best counter strike player ever - is your dad and blizzard game studios is your rich uncle. You stream daily to zero twitch tv viewers but you know your breakthrough 
  is just around the corner. CS2 is the worlds most perfect game. Games like valorant are inferior and pathetic copies. Will is the worst baiting noob gamer and is the reason you are in elo hell.
  `