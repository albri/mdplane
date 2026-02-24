import chalk from 'chalk';
import { BRAND_ACCENT_HEX, splitWordmarkLines } from '@mdplane/shared';

export interface OutputOptions {
  json?: boolean;
}

const accent = chalk.hex(BRAND_ACCENT_HEX);

export function renderAsciiWordmark(): string {
  return splitWordmarkLines()
    .map((line) => `${accent(line.accent)}${chalk.white(line.base)}`)
    .join('\n');
}

/**
 * Exit with a validation error, handling both JSON and regular output.
 */
export function exitWithValidationError(opts: {
  message: string;
  options: OutputOptions;
  helpText?: string;
}): never {
  if (opts.options.json === true) {
    outputError({ error: opts.message }, opts.options);
  } else {
    error(opts.message);
    if (opts.helpText != null && opts.helpText !== '') info(opts.helpText);
  }
  process.exit(1);
}

/**
 * Read content from stdin.
 */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

/**
 * Print success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Print error message
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Print warning message
 */
export function warn(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.log(chalk.cyan('ℹ'), message);
}

/**
 * Print a key-value pair
 */
export function keyValue(key: string, value: string): void {
  console.log(`  ${chalk.gray(key + ':')} ${value}`);
}

/**
 * Print a header
 */
export function header(text: string): void {
  console.log();
  console.log(chalk.bold(text));
  console.log(chalk.gray('─'.repeat(text.length)));
}

/**
 * Output data as JSON or formatted
 */
export function output<T>(opts: {
  data: T;
  options: OutputOptions;
  formatter: (data: T) => void;
}): void {
  if (opts.options.json === true) {
    console.log(JSON.stringify(opts.data, null, 2));
  } else {
    opts.formatter(opts.data);
  }
}

/**
 * Output error as JSON or formatted
 */
export function outputError(error: Record<string, unknown>, options: OutputOptions): void {
  if (options.json === true) {
    console.error(JSON.stringify(error));
  }
}

/**
 * Handle errors consistently
 */
export function handleError(err: unknown, options: OutputOptions): never {
  if (err instanceof Error) {
    if (options.json === true) {
      outputError({ error: err.message }, options);
    } else {
      error(err.message);
    }
  } else {
    if (options.json === true) {
      outputError({ error: 'Unknown error' }, options);
    } else {
      error('An unknown error occurred');
    }
  }
  process.exit(1);
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString();
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

