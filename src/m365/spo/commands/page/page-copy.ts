import * as chalk from 'chalk';
import { Logger } from '../../../../cli';
import { CommandOption } from '../../../../Command';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import SpoCommand from '../../../base/SpoCommand';
import commands from '../../commands';
import { ClientSidePageProperties } from './ClientSidePageProperties';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  sourceName: string;
  targetName: string;
  webUrl: string;
  overwrite?: boolean;
}

class SpoPageCopyCommand extends SpoCommand {
  public get name(): string {
    return `${commands.PAGE_COPY}`;
  }

  public get description(): string {
    return 'Creates a copy of a modern page or template';
  }

  public defaultProperties(): string[] | undefined {
    return ['Id', 'PageLayoutType', 'Title', 'Url'];
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.sourceName = typeof args.options.sourceName !== 'undefined';
    telemetryProps.targetName = typeof args.options.targetName !== 'undefined';
    telemetryProps.overwrite = !!args.options.overwrite;
    return telemetryProps;
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    let sourceFullName: string = args.options.sourceName.toLowerCase();
    let targetFullName: string = args.options.targetName.toLowerCase();

    if (sourceFullName.indexOf('.aspx') < 0) {
      sourceFullName += '.aspx';
    }
    if (targetFullName.indexOf('.aspx') < 0) {
      targetFullName += '.aspx';
    }

    if (this.verbose) {
      logger.logToStderr(`Creating page copy...`);
    }

    const requestOptions: any = {
      url: `${args.options.webUrl}/_api/SP.MoveCopyUtil.CopyFileByPath()`,
      headers: {
        'accept': 'application/json;odata=nometadata'
      },
      data: {
        srcPath: { DecodedUrl: `${args.options.webUrl}/sitepages/${sourceFullName}` },
        destPath: { DecodedUrl: `${args.options.webUrl}/sitepages/${targetFullName}` },
        options: { ResetAuthorAndCreatedOnCopy: true, ShouldBypassSharedLocks: true },
        overwrite: !!args.options.overwrite
      },
      responseType: 'json'
    };

    request
      .post<void>(requestOptions)
      .catch((err: any): void => {
        // The API returns a 400 when file already exists
        if (err && err.response && err.response.status && err.response.status === 400) {
          return;
        }
        // Throw the error if something else happened
        throw err;
      })
      .then((): Promise<ClientSidePageProperties> => {
        const requestOptions: any = {
          url: `${args.options.webUrl}/_api/sitepages/pages/GetByUrl('sitepages/${targetFullName}')`,
          headers: {
            'accept': 'application/json;odata=nometadata'
          },
          responseType: 'json'
        };

        return request.get<ClientSidePageProperties>(requestOptions)
      })
      .then((res: ClientSidePageProperties): void => {
        logger.log(res);

        if (this.verbose) {
          logger.logToStderr(chalk.green('DONE'));
        }

        cb();
      })
      .catch((err: any): void => {
        return this.handleRejectedODataJsonPromise(err, logger, cb)
      });
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '--sourceName <sourceName>',
        description: 'The name of the source file'
      },
      {
        option: '--targetName <targetName>',
        description: 'The name of the target file to be created'
      },
      {
        option: '-u, --webUrl <webUrl>',
        description: 'URL of the site where the page should be created'
      },
      {
        option: '--overwrite',
        description: 'Overwrite the target page when it already exists'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(args: CommandArgs): boolean | string {
    const isValidSharePointUrl: boolean | string = SpoCommand.isValidSharePointUrl(args.options.webUrl);
    if (isValidSharePointUrl !== true) {
      return isValidSharePointUrl;
    }

    return true;
  }
}

module.exports = new SpoPageCopyCommand();