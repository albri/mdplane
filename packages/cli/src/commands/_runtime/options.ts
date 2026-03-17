import { exitWithValidationError, type OutputOptions } from '../../utils.js';

export interface ParseBoundedIntOptions<TOptions extends OutputOptions> {
  value: string | undefined;
  defaultValue: number;
  min: number;
  max: number;
  optionName: string;
  options: TOptions;
}

export function parseBoundedIntOption<TOptions extends OutputOptions>(
  opts: ParseBoundedIntOptions<TOptions>
): number {
  if (opts.value == null) {
    return opts.defaultValue;
  }

  const parsed = parseInt(opts.value, 10);

  if (Number.isNaN(parsed)) {
    exitWithValidationError({
      message: `${opts.optionName} must be a valid integer`,
      options: opts.options,
    });
  }

  if (parsed < opts.min || parsed > opts.max) {
    exitWithValidationError({
      message: `${opts.optionName} must be between ${String(opts.min)} and ${String(opts.max)}`,
      options: opts.options,
    });
  }

  return parsed;
}
