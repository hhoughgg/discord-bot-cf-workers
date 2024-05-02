import { InteractionType } from "discord-interactions";

// https://discord.com/developers/docs/interactions/application-commands

export const PING_COMMAND = {
  type: 1,
  name: 'ping',
  description: 'Check the bot is alive',
};

export const QUESTION_COMMAND = {
  type: 1,
  name: 'question',
  description: 'Ask a question of the bot',
  options: [{
    "name": "ai",
    "type": 3,
    "required": true,
    "description": "AI should answer the question",
  }]
};

export type ApplicationCommandOption = {
  id?: string, 
  type: number,
  value: string,
  name: string, 
  description?: string,
}

export type InteractionRequest = {
  app_permissions: string,
  application_id: string,
  entitlements: Array<string>,
  id: string,
  token: string,
  type: InteractionType,
  channel?: {
    flags: number,
    id: string,
    last_message_id: string,
    recipients: Array<Array<Object>>,
    type: number
  },
  guild?: {
    features: Array<string>,
    id: string,
    locale: string
  },
  guild_id?: string,
  guild_locale?: string,
  channel_id?: string,
  data?: { 
    id: string, 
    name: string, 
    type: number,
    options: Array<ApplicationCommandOption>,
  },
  member: {
    flags: number
    user: {
      avatar: string,
      avatar_decoration_data: string | null,
      bot: boolean,
      clan: string | null,
      discriminator: string,
      global_name: string,
      id: string,
      public_flags: number,
      system: boolean,
      username: string
    },
  }
  version: number
}