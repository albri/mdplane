import { describe, test, expect } from 'bun:test';
import { runCli } from '../helpers/run-cli.js';

describe('CLI', () => {
  describe('help output', () => {
    test('should display help when --help flag is provided', async () => {
      const { stdout, exitCode } = await runCli('--help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('mdplane');
    });

    test('should display version when --version flag is provided', async () => {
      const { stdout, exitCode } = await runCli('--version');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should display command-specific help', async () => {
      const { stdout, exitCode } = await runCli('append --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('append');
    });

    test('should display help for ls command', async () => {
      const { stdout, exitCode } = await runCli('ls --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('ls');
    });

    test('should display help for search command', async () => {
      const { stdout, exitCode } = await runCli('search --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('search');
    });

    test('should display help for export command', async () => {
      const { stdout, exitCode } = await runCli('export --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('export');
    });

    test('should display help for mkdir command', async () => {
      const { stdout, exitCode } = await runCli('mkdir --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('mkdir');
    });

    test('should display help for mv command', async () => {
      const { stdout, exitCode } = await runCli('mv --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('mv');
    });

    test('should display help for rm command', async () => {
      const { stdout, exitCode } = await runCli('rm --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('rm');
    });

    test('should display help for recover command', async () => {
      const { stdout, exitCode } = await runCli('recover --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('recover');
    });

    test('should display help for rotate command', async () => {
      const { stdout, exitCode } = await runCli('rotate --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('rotate');
    });

    test('should display help for claim command', async () => {
      const { stdout, exitCode } = await runCli('claim --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('claim');
    });

    test('should display help for settings command', async () => {
      const { stdout, exitCode } = await runCli('settings --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('settings');
    });

    test('should display help for check-keys command', async () => {
      const { stdout, exitCode } = await runCli('check-keys --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('check-keys');
    });

    test('should display help for login command', async () => {
      const { stdout, exitCode } = await runCli('login --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('login');
    });
  });
});
