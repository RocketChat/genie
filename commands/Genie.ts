import {
    IHttp,
    IHttpResponse,
    IMessageBuilder,
    IModify,
    IModifyCreator,
    IPersistence,
    IRead
} from '@rocket.chat/apps-engine/definition/accessors'
import { IMessage } from '@rocket.chat/apps-engine/definition/messages'
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms'
import {
    ISlashCommand,
    SlashCommandContext
} from '@rocket.chat/apps-engine/definition/slashcommands'
import { IUser } from '@rocket.chat/apps-engine/definition/users'

export class GennieCommand implements ISlashCommand {
    public command = 'genie'
    public i18nDescription = ''
    public providesPreview = false
    public i18nParamsExample = ''

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const apiKey = await read.getEnvironmentReader().getSettings().getValueById('opsgenie_api_key');
        const notifyOnly = await read.getEnvironmentReader().getSettings().getValueById('opsgenie_notify_only');
        const cmdParams = context.getArguments();
        let httpMethod = 'GET';
        let response: IHttpResponse;
        let apiHeaders = this.buildHeader(apiKey);
        let url = 'https://api.opsgenie.com/v2/';

        if (!cmdParams || cmdParams.length === 0) {
            this.notifyMessage(context, modify, "Subcommand required");
        }

        const subCmd = cmdParams[0];

        if (subCmd === 'list' && cmdParams.length === 1) {
            //list open alerts
            url = url + 'alerts?query=status%3Aopen&offset=0&limit=100&sort=createdAt&order=desc';
            this.processGet('List Alerts',http, apiHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'list' && cmdParams[1] === 'teams') {
            //list teams
            url = url + 'teams';
            this.processGet('List Teams',http, apiHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'get') {
            //get alert
            if (cmdParams.length === 1) {
                this.notifyMessage(context, modify, 'Missing alert id');
            }
            url = url + 'alerts?query=tinyId%3A' + cmdParams[1];
            this.processGet('Get Alert '+cmdParams[1],http, apiHeaders, url, context, modify, read, notifyOnly);
        } else {
            this.notifyMessage(context, modify, 'Could not identify subcommand: `' + cmdParams.join(" ") + '`');
        }

    }
    private async processGet(headLine: string,http: IHttp, apiHeaders: any, url: string, context: SlashCommandContext, modify: IModify, read: IRead, notifyOnly: any) {
        let response = await http.get(url, {
            headers: apiHeaders
        });
        this.processResponse(headLine,response, context, modify, read, notifyOnly);
    }


    private formatMessage(headLine:string,responseContent: any | undefined) {
        if (responseContent) {
            return '*'+headLine+'*:\n```\n' + JSON.stringify(JSON.parse('' + responseContent), null, 2) + '\n```'
        } else {
            return '*'+headLine+'*:\n```\n{}\n```';
        }
    }


    private async notifyMessage(context: SlashCommandContext, modify: IModify, message: string): Promise<void> {
        const notifier = modify.getNotifier();
        const messageBuilder = notifier.getMessageBuilder();
        const room = context.getRoom();
        messageBuilder.setText(message);
        messageBuilder.setRoom(room);
        await notifier.notifyUser(context.getSender(), messageBuilder.getMessage());
    }

    private buildHeader(apiKey: string): any {
        return { 'Authorization': 'GenieKey ' + apiKey };
    }

    private async processResponse(headLine:string,response: IHttpResponse, context: SlashCommandContext, modify: IModify, read: IRead, notifyOnly: any) {
        if (response.statusCode != 200) {
            return await this.notifyMessage(context, modify, '*Error calling HTTP:*\n```\n' + response.content + "\n```");
        }
        let responseMsg = this.formatMessage(headLine,response.content);
        if (notifyOnly) {
            this.notifyMessage(context, modify, responseMsg);
        } else {
            const creator: IModifyCreator = modify.getCreator()
            const sender: IUser = (await read.getUserReader().getAppUser()) as IUser
            const room: IRoom = context.getRoom()
            const messageTemplate: IMessage = {
                text: responseMsg,
                sender,
                room
            }
            const messageBuilder: IMessageBuilder = creator.startMessage(messageTemplate)
            await creator.finish(messageBuilder);
        }
    }
}


