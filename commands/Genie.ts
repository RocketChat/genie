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
import { IUser, IUserEmail } from '@rocket.chat/apps-engine/definition/users'

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
        const apiIntegrationKey = await read.getEnvironmentReader().getSettings().getValueById('opsgenie_api_integration_key');
        const notifyOnly = await read.getEnvironmentReader().getSettings().getValueById('opsgenie_notify_only');
        const domain = await read.getEnvironmentReader().getSettings().getValueById('opsgenie_domain');
        const cmdParams = context.getArguments();
        let apiHeaders = this.buildHeader(apiKey);
        let apiIntegrationHeaders = this.buildHeader(apiIntegrationKey);
        let url = await read.getEnvironmentReader().getSettings().getValueById('opsgenie_api_url');

        if (!cmdParams || cmdParams.length === 0) {
            return this.notifyMessage(context, modify, "Subcommand required");
        }

        const subCmd = cmdParams[0];

        if (subCmd === 'list' && cmdParams.length === 1) {
            //list open alerts - the one with formatting per line
            let response = await this.listOpenAlerts(http, apiHeaders, url);
            if (response.statusCode != 200 && response.statusCode != 202) {
                return await this.notifyMessage(context, modify, '*Error calling HTTP:*\n```\n' + response.content + "\n```");
            }
            let responseObject = response.content ? JSON.parse('' + response.content) : { data: [] };
            let headLine = '*List Alerts*: Found ' + responseObject.data.length + ' open alerts';
            let responseMsg = headLine + '\n' + getAlertListMessage(responseObject, domain) + '\n';
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
        } else if (subCmd === 'list' && cmdParams[1] === 'teams') {
            //list teams
            url = url + 'teams';
            this.processGet('List Teams', http, apiHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'list' && cmdParams[1] === 'integrations') {
            //list integrations
            url = url + 'integrations';
            this.processGet('List Integrations', http, apiHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'list' && cmdParams[1] === 'policies') {
            //list policies
            url = url + 'policies/alert';
            this.processGet('List Policies', http, apiHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'list' && cmdParams[1] === 'schedules') {
            //list schedules
            url = url + 'schedules';
            this.processGet('List Schedules', http, apiIntegrationHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'get') {
            //get alert
            if (cmdParams.length === 1) {
                return this.notifyMessage(context, modify, 'Missing alert id');
            }
            url = url + 'alerts?query=tinyId%3A' + cmdParams[1];
            this.processGet('Get Alert ' + cmdParams[1], http, apiHeaders, url, context, modify, read, notifyOnly);
        } else if (subCmd === 'alert') {
            //create alert
            const alertmsg = this.getAlertMsg(cmdParams);
            if (alertmsg === '') {
                return this.notifyMessage(context, modify, 'State alert message before `for` keyword.');
            }
            let alertPayload = {
                message: alertmsg.trim(),
                responders: []
            }
            alertPayload = this.getAlertUsersTeams(alertPayload, cmdParams);
            url = url + 'alerts';
            this.processPost('Alert Created', apiIntegrationHeaders, url, alertPayload, http, context, modify, read, notifyOnly);
        } else if (subCmd === 'assign') {
            //asign alerts
            if (cmdParams.length < 4) {
                return this.notifyMessage(context, modify, 'Assign subcommand missing information.');
            }
            const userToAssign = this.getUserToAssign(cmdParams);
            if (userToAssign === '') {
                return this.notifyMessage(context, modify, 'State user to assign alerts after `to` keyword.');
            }
            let assigneePayload = {
                owner: { username: userToAssign }
            };
            for (let i = 1; i < cmdParams.length; ++i) {
                if (cmdParams[i] == 'to') {
                    break;
                }
                let urlCall = url + 'alerts/' + cmdParams[i] + '/assign?identifierType=tiny';
                this.processPost('Alert Assigned ' + cmdParams[i] + ' to ' + userToAssign, apiIntegrationHeaders, urlCall, assigneePayload, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'ack') {
            //aknowledge alerts
            if (cmdParams.length < 2) {
                return this.notifyMessage(context, modify, 'Aknowledge subcommand missing alerts.');
            }
            for (let i = 1; i < cmdParams.length; ++i) {
                let urlCall = url + 'alerts/' + cmdParams[i] + '/acknowledge?identifierType=tiny';
                this.processPost('Alert Aknowledged ' + cmdParams[i], apiIntegrationHeaders, urlCall, {}, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'close') {
            //closes alerts
            if (cmdParams.length < 2) {
                return this.notifyMessage(context, modify, 'Close subcommand missing alerts.');
            }
            for (let i = 1; i < cmdParams.length; ++i) {
                let urlCall = url + 'alerts/' + cmdParams[i] + '/close?identifierType=tiny';
                this.processPost('Alert Closed ' + cmdParams[i], apiIntegrationHeaders, urlCall, {}, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'note') {
            //add note to alerts
            const notemsg = this.getNoteMsg(cmdParams);
            if (notemsg === '') {
                return this.notifyMessage(context, modify, 'State note before `to` keyword.');
            }
            let notePayload = {
                note: notemsg.trim()
            }
            let alertIds = this.getArrayAfterSeparator(cmdParams, 'to');
            for (let i = 0; i < alertIds.length; ++i) {
                let newUrl = url + 'alerts/' + alertIds[i] + '/notes?identifierType=tiny';
                this.processPost('Note Added to Alert ' + alertIds[i], apiIntegrationHeaders, newUrl, notePayload, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'addtag') {
            //add tags to alerts
            const tags: string[] = this.getTagsMsg(cmdParams);
            if (tags.length === 0) {
                return this.notifyMessage(context, modify, 'State tags before `to` keyword.');
            }
            let tagsPayload = {
                tags: tags
            }
            let alertIds = this.getArrayAfterSeparator(cmdParams, 'to');
            for (let i = 0; i < alertIds.length; ++i) {
                let newUrl = url + 'alerts/' + alertIds[i] + '/tags?identifierType=tiny';
                this.processPost('Tags Added to Alert ' + alertIds[i], apiIntegrationHeaders, newUrl, tagsPayload, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'ackall') {
            if (cmdParams.length > 1) {
                return this.notifyMessage(context, modify, 'Ackall subcommand does not receive arguments.');
            }
            let response = await this.listOpenAlerts(http, apiHeaders, url);
            if (response.statusCode != 200 && response.statusCode != 202) {
                return await this.notifyMessage(context, modify, '*Error calling HTTP:*\n```\n' + response.content + "\n```");
            }
            let responseObj = JSON.parse('' + response.content);
            for (let i = 0; responseObj.data && i < responseObj.data.length; i++) {
                let alertObj = responseObj.data[i];
                let urlCall = url + 'alerts/' + alertObj.tinyId + '/acknowledge?identifierType=tiny';
                this.processPost('Alert Aknowledged ' + alertObj.tinyId, apiIntegrationHeaders, urlCall, {}, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'closeall') {
            if (cmdParams.length > 1) {
                return this.notifyMessage(context, modify, 'Closeall subcommand does not receive arguments.');
            }
            let response = await this.listOpenAlerts(http, apiHeaders, url);
            if (response.statusCode != 200 && response.statusCode != 202) {
                return await this.notifyMessage(context, modify, '*Error calling HTTP:*\n```\n' + response.content + "\n```");
            }
            let responseObj = JSON.parse('' + response.content);
            for (let i = 0; responseObj.data && i < responseObj.data.length; i++) {
                let alertObj = responseObj.data[i];
                let urlCall = url + 'alerts/' + alertObj.tinyId + '/close?identifierType=tiny';
                this.processPost('Alert Closed ' + alertObj.tinyId, apiIntegrationHeaders, urlCall, {}, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'own') {
            if (cmdParams.length < 2) {
                return this.notifyMessage(context, modify, 'Own subcommand requires at least one alert (tiny) id to be passed.');
            }
            let userEmails: IUserEmail[] = context.getSender().emails;
            if (!userEmails || userEmails.length == 0) {
                return this.notifyMessage(context, modify, 'User has no email address to assign alerts.');
            }
            let assigneePayload = {
                owner: { username: userEmails[0].address }
            };
            for (let i = 1; i < cmdParams.length; ++i) {
                let urlCall = url + 'alerts/' + cmdParams[i] + '/assign?identifierType=tiny';
                this.processPost('Alert ' + cmdParams[i] + ' Assigned to ' + userEmails[0].address, apiIntegrationHeaders, urlCall, assigneePayload, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'update') {
            if (cmdParams.length < 6) {
                return this.notifyMessage(context, modify, 'Update subcommand requires more arguments.');
            }
            if (cmdParams[1] !== 'priority') {
                return this.notifyMessage(context, modify, 'Update ' + cmdParams[1] + ' not implemented.');
            }
            if (cmdParams[2] !== 'to') {
                return this.notifyMessage(context, modify, 'Update priority has syntax: \`/genie update priority to [P1, P2, P3, P4 or P5] for [tinyID]\`');
            }
            let priority = cmdParams[3];
            if (cmdParams[4] !== 'for') {
                return this.notifyMessage(context, modify, 'Update priority has syntax: \`/genie update priority to [P1, P2, P3, P4 or P5] for [tinyID]\`');
            }
            let alertId = cmdParams[5];
            let priorityPayload = {
                priority: priority
            };
            let urlCall = url + 'alerts/' + alertId + '/priority?identifierType=tiny';
            this.processPost('Alert Priority for ' + alertId + ' Set to ' + priority, apiIntegrationHeaders, urlCall, priorityPayload, http, context, modify, read, notifyOnly);
        } else if (subCmd === 'exec') {
            if (cmdParams.length < 4) {
                return this.notifyMessage(context, modify, 'Execute action subcommand requires more arguments.');
            }
            let action = cmdParams[1];
            if (cmdParams[2] !== 'on') {
                return this.notifyMessage(context, modify, 'Execute action has syntax: \`/genie exec [action] on [tinyID tinyID2..]\`');
            }
            let tinyIds: string[] = this.getArrayAfterSeparator(cmdParams, 'on');

            for (let i = 0; i < tinyIds.length; i++) {
                let urlCall = url + 'alerts/' + tinyIds[i] + '/actions/' + action + '?identifierType=tiny';
                let actionPayload = {};
                this.processPost('Execute Action ' + action + ' ' + tinyIds[i], apiIntegrationHeaders, urlCall, actionPayload, http, context, modify, read, notifyOnly);
            }
        } else if (subCmd === 'enable') {
            if (cmdParams.length < 3) {
                return this.notifyMessage(context, modify, 'Enable integration/policy subcommand requires more arguments.');
            }
            let integrationPolicy = cmdParams[1];
            if (integrationPolicy !== 'policy' && integrationPolicy !== 'integration') {
                return this.notifyMessage(context, modify, 'Enable integration/policy subcommand only accepts integration or policy as second argument.');
            } else if (integrationPolicy == 'policy') {
                integrationPolicy = 'policies';
            } else {
                integrationPolicy = 'integrations';
            }
            let intPolValue = cmdParams[2];
            let urlCall = url + integrationPolicy + '/' + intPolValue + '/enable';
            let payload = {};
            this.processPost('Enable ' + cmdParams[1] + ' ' + intPolValue, apiIntegrationHeaders, urlCall, payload, http, context, modify, read, notifyOnly);
        } else if (subCmd === 'disable') {
            if (cmdParams.length < 3) {
                return this.notifyMessage(context, modify, 'Disable integration/policy subcommand requires more arguments.');
            }
            let integrationPolicy = cmdParams[1];
            if (integrationPolicy !== 'policy' && integrationPolicy !== 'integration') {
                return this.notifyMessage(context, modify, 'Disable integration/policy subcommand only accepts integration or policy as second argument.');
            } else if (integrationPolicy == 'policy') {
                integrationPolicy = 'policies';
            } else {
                integrationPolicy = 'integrations';
            }
            let intPolValue = cmdParams[2];
            let urlCall = url + integrationPolicy + '/' + intPolValue + '/disable';
            let payload = {};
            this.processPost('Enable ' + cmdParams[1] + ' ' + intPolValue, apiIntegrationHeaders, urlCall, payload, http, context, modify, read, notifyOnly);
        } else if (subCmd === 'whoisoncall') {
            if (cmdParams.length > 2) {
                return this.notifyMessage(context, modify, 'Whoisoncall subcommand doesnt accept so many arguments.');
            } else if (cmdParams.length == 1) {
                //all schedules
                let response = await this.listSchedules(http, apiIntegrationHeaders, url);
                if (response.statusCode != 200 && response.statusCode != 202) {
                    return await this.notifyMessage(context, modify, '*Error calling HTTP:*\n```\n' + response.content + "\n```");
                }
                let responseObj = JSON.parse('' + response.content);
                for (let i = 0; responseObj.data && i < responseObj.data.length; i++) {
                    let scheduleObj = responseObj.data[i];
                    let urlCall = url + 'schedules/' + scheduleObj.id + '/on-calls';
                    this.processGet('Who is on calls for ' + scheduleObj.id, http, apiIntegrationHeaders, urlCall, context, modify, read, notifyOnly);
                }
            } else {
                //single schedule
                let scheduleId = cmdParams[1];
                url = url + 'schedules/' + scheduleId + '/on-calls';
                this.processGet('Who is on calls for ' + scheduleId, http, apiIntegrationHeaders, url, context, modify, read, notifyOnly);
            }
        } else {
            this.notifyMessage(context, modify, 'Could not identify subcommand: `' + cmdParams.join(" ") + '`');
        }

    }

    async listSchedules(http: IHttp, apiIntegrationHeaders: any, baseUrl: string) {
        return await http.get(baseUrl + 'schedules', {
            headers: apiIntegrationHeaders
        });
    }

    async listOpenAlerts(http: IHttp, apiHeaders: any, baseUrl: string) {
        return await http.get(baseUrl + 'alerts?query=status%3Aopen&offset=0&limit=100&sort=createdAt&order=desc', {
            headers: apiHeaders
        });
    }



    private async processGet(headLine: string, http: IHttp, apiHeaders: any, url: string, context: SlashCommandContext, modify: IModify, read: IRead, notifyOnly: any) {
        let response = await http.get(url, {
            headers: apiHeaders
        });
        this.processResponse(headLine, response, context, modify, read, notifyOnly);
    }


    async processPost(headLine: string, apiHeaders: any, url: string, payload: any, http: IHttp, context: SlashCommandContext, modify: IModify, read: IRead, notifyOnly: any) {
        //console.log(url);
        //console.log(JSON.stringify(payload));

        let response = await http.post(url, {
            headers: apiHeaders,
            content: JSON.stringify(payload)
        });
        this.processResponse(headLine, response, context, modify, read, notifyOnly);
    }
    getUserToAssign(cmdParams: string[]) {
        for (let i = 1; i < cmdParams.length; ++i) {
            if (cmdParams[i] == 'to' && i + 1 < cmdParams.length) {
                return cmdParams[i + 1];
            }
        }
        return '';
    }
    getAlertUsersTeams(alertPayload: any, cmdParams: string[]) {
        let startUser = false;
        for (let i = 1; i < cmdParams.length; ++i) {
            if (cmdParams[i] == 'for' && !startUser) {
                startUser = true;
            } else if (startUser) {
                let usersTeams = (cmdParams.slice(i).join(' ')).split(',');
                for (let j = 0; j < usersTeams.length; ++j) {
                    let userTeam = usersTeams[j];
                    if (userTeam.indexOf('@') != -1) {
                        alertPayload.responders.push({ type: 'user', username: userTeam });
                    } else {
                        alertPayload.responders.push({ type: 'team', name: userTeam });
                    }
                }
                break;
            }
        }
        return alertPayload;
    }

    getMsgFromCmd(cmdParams: string[], stringSeparator: string) {
        let msg = '';
        for (let i = 1; i < cmdParams.length; ++i) {
            if (cmdParams[i] == stringSeparator)
                break;
            msg = msg + ' ' + cmdParams[i];
        }
        return msg;
    }

    getArrayAfterSeparator(cmdParams: string[], stringSeparator: string) {
        let arrayAfter: string[] = [];
        for (let i = 1, isAfter = false; i < cmdParams.length; ++i) {
            if (isAfter) {
                arrayAfter.push(cmdParams[i]);
            } else if (cmdParams[i] == stringSeparator) {
                isAfter = true;
            }
        }
        return arrayAfter;
    }

    getTagsMsg(cmdParams: string[]) {
        let tagsValue = this.getMsgFromCmd(cmdParams, 'to');
        return tagsValue.split(',');
    }

    getNoteMsg(cmdParams: string[]) {
        return this.getMsgFromCmd(cmdParams, 'to');
    }

    getAlertMsg(cmdParams: string[]) {
        return this.getMsgFromCmd(cmdParams, 'for');
    }


    private formatMessage(headLine: string, responseContent: any | undefined) {
        if (responseContent) {
            return '*' + headLine + '*:\n```\n' + JSON.stringify(JSON.parse('' + responseContent), null, 2) + '\n```'
        } else {
            return '*' + headLine + '*:\n```\n{}\n```';
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
        return { 'Authorization': 'GenieKey ' + apiKey, 'Content-Type': 'application/json' };
    }

    private async processResponse(headLine: string, response: IHttpResponse, context: SlashCommandContext, modify: IModify, read: IRead, notifyOnly: any) {

        if (response.statusCode != 200 && response.statusCode != 202) {
            return await this.notifyMessage(context, modify, '*Error calling HTTP:*\n```\n' + response.content + "\n```");
        }
        let responseMsg = this.formatMessage(headLine, response.content);
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


function getAlertListMessage(responseObject: any, domain: string) {
    let message = '';
    for (let i = 0; i < responseObject.data.length; i++) {
        let alert = responseObject.data[i];
        let ackedMsg = alert.aknowledged ? 'acked' : 'unacked';
        message = message + '- #' + alert.tinyId + ': ' + alert.message + ' [' + ackedMsg + '] - [View details](' + domain + '/alert/detail/' + alert.id + '/details).';
        if (i != responseObject.data.length - 1) {
            message = message + '\n';
        }
    }
    return message;
}

