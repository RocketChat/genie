import {
    IAppAccessors,
    IConfigurationExtend,
    ILogger,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings/SettingType';
import { GennieCommand } from './commands/Genie';

export class GenieApp extends App {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(
        configuration: IConfigurationExtend
      ): Promise<void> {
        await configuration.settings.provideSetting({
            id: 'opsgenie_api_key',
            type: SettingType.STRING,
            packageValue: 'XXX-YYYY-ZZZ-WWWW-VVVV',
            required: true,
            public: false,
            multiline: false,
            i18nLabel: 'opsgenie_api_key',
            i18nDescription: 'opsgenie_api_key_desc',
        });

        await configuration.settings.provideSetting({
            id: 'opsgenie_api_integration_key',
            type: SettingType.STRING,
            packageValue: 'XXX-YYYY-ZZZ-WWWW-VVVV',
            required: true,
            public: false,
            multiline: false,
            i18nLabel: 'opsgenie_api_integration_key',
            i18nDescription: 'opsgenie_api_integration_key_desc',
        });

        await configuration.settings.provideSetting({
            id: 'opsgenie_notify_only',
            type: SettingType.BOOLEAN,
            packageValue: true,
            required: true,
            public: false,
            multiline: false,
            i18nLabel: 'opsgenie_notify_only',
            i18nDescription: 'opsgenie_notify_only_desc',
        });

        const genieCommand: GennieCommand = new GennieCommand();
        await configuration.slashCommands.provideSlashCommand(genieCommand);
      }
}
