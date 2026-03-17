import { handleError, type OutputOptions } from '../../utils.js';

export async function runCommandAction(
  options: OutputOptions,
  fn: () => void | Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    handleError(err, options);
  }
}
