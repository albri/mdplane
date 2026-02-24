import type { Command } from 'commander';
import { ApiClient, type ApiFileDeleteResponse, type ApiFolderDeleteResponse } from '../api.js';
import {
  success,
  info,
  keyValue,
  header,
  output,
  exitWithValidationError,
  type OutputOptions,
} from '../utils.js';
import { runCommandAction, requireContextWithMode } from './_runtime/index.js';

interface RmOptions extends OutputOptions {
  permanent?: boolean;
  force?: boolean;
  profile?: string;
}

export function registerRmCommand(program: Command): void {
  program
    .command('rm <path>')
    .description('Remove file or folder')
    .option('-p, --profile <name>', 'Profile to use')
    .option('-P, --permanent', 'Permanently delete (irreversible)')
    .option('-f, --force', 'Force delete without confirmation')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `

Examples:
  Soft delete a file (move to trash):
    $ mdplane rm /notes/old.md

  Permanently delete a file:
    $ mdplane rm /notes/old.md --permanent

  Delete a folder:
    $ mdplane rm /old-folder/

  Output as JSON:
    $ mdplane rm /notes/old.md --json
  `)
    .action(async (path: string, options: RmOptions) => {
      await runCommandAction(options, () => runRm(path, options));
    });
}

async function runRm(targetPath: string, options: RmOptions): Promise<void> {
  const { ctx, key: writeKey, mode } = requireContextWithMode({
    profile: options.profile,
    options,
    capability: 'write',
    errorMessage: 'Write key is required to delete files or folders.',
    hint: 'Make sure your profile contains write capability URL or API key.',
  });

  const client = new ApiClient({ baseUrl: ctx.apiUrl, apiKey: ctx.apiKey });

  if (options.json !== true) {
    info(`Removing ${targetPath}...`);
  }

  const isFolder = targetPath.endsWith('/');

  let result: ApiFileDeleteResponse | ApiFolderDeleteResponse;

  try {
    if (mode === 'api-key') {
      if (isFolder) {
        result = await client.deleteFolderByPath(targetPath);
      } else {
        result = await client.deleteFileByPath(targetPath, options.permanent);
      }
    } else {
      if (isFolder) {
        const folderPath = targetPath.replace(/^\/+|\/+$/g, '');
        if (folderPath === '') {
          exitWithValidationError({ message: 'Cannot delete root folder.', options });
        }
        result = await client.deleteFolderViaCapability(writeKey, folderPath);
      } else {
        result = await client.deleteFile(writeKey, options.permanent, targetPath);
      }
    }

    // Handle union type: file delete has 'id', folder delete has 'path'
    if ('id' in result) {
      // File delete response - narrow the type
      const fileResult = result;
      const outputData = {
        id: fileResult.id,
        targetPath,
        deleted: fileResult.deleted,
        recoverable: fileResult.recoverable,
        expiresAt: fileResult.expiresAt,
      };

      output({
        data: outputData,
        options,
        formatter: () => {
          header(`Removed: ${targetPath}`);
          keyValue('ID', fileResult.id);
          keyValue('Path', targetPath);
          keyValue('Deleted', fileResult.deleted.toString());
          if (fileResult.recoverable === true) {
            keyValue('Recoverable', 'Yes');
            if (fileResult.expiresAt != null && fileResult.expiresAt !== '') {
              keyValue('Expires At', fileResult.expiresAt);
            }
          }
          console.log();
          success('Deleted successfully!');
        },
      });
    } else {
      // Folder delete response - narrow the type
      const folderResult = result;
      const outputData = {
        path: folderResult.path,
        targetPath,
        deleted: folderResult.deleted,
        recoverable: folderResult.recoverable,
        expiresAt: folderResult.expiresAt,
        filesDeleted: folderResult.filesDeleted,
        foldersDeleted: folderResult.foldersDeleted,
      };

      output({
        data: outputData,
        options,
        formatter: () => {
          header(`Removed: ${targetPath}`);
          keyValue('Path', folderResult.path);
          keyValue('Deleted', folderResult.deleted.toString());
          if (folderResult.filesDeleted != null) {
            keyValue('Files Deleted', folderResult.filesDeleted.toString());
          }
          if (folderResult.foldersDeleted != null) {
            keyValue('Folders Deleted', folderResult.foldersDeleted.toString());
          }
          if (folderResult.recoverable === true) {
            keyValue('Recoverable', 'Yes');
            if (folderResult.expiresAt != null && folderResult.expiresAt !== '') {
              keyValue('Expires At', folderResult.expiresAt);
            }
          }
          console.log();
          success('Deleted successfully!');
        },
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      exitWithValidationError({ message: `Path not found: ${targetPath}`, options });
    }
    throw err;
  }
}
