import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliEntrypointPath = path.join(__dirname, '..', '..', '..', 'dist', 'index.js');

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function sanitizeEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  delete env.MDPLANE_API_KEY;
  delete env.MDPLANE_READ_KEY;
  delete env.MDPLANE_APPEND_KEY;
  delete env.MDPLANE_WRITE_KEY;
  return env;
}

function splitArgs(args: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i] ?? '';
    if (quote != null) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && i + 1 < args.length) {
        i += 1;
        current += args[i] ?? '';
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current !== '') {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current !== '') {
    tokens.push(current);
  }

  return tokens;
}

export function runCliWithCwd(
  args: string,
  cwd: string,
  envOverrides: Record<string, string | undefined> = {}
): Promise<ExecResult> {
  const argv = [cliEntrypointPath, ...splitArgs(args)];
  const env = { ...sanitizeEnv(), ...envOverrides };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, argv, {
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      stderr += error.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });
  });
}

export function runCli(args: string): Promise<ExecResult> {
  return runCliWithCwd(args, process.cwd());
}
