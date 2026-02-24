import { cleanupDeletedFiles } from './cleanup-deleted-files';
import { cleanupExpiredRateLimits } from './cleanup-rate-limits';
import { cleanupWebhookDeliveries } from './cleanup-webhook-deliveries';
import { expireClaims } from './expire-claims';

interface Job {
  name: string;
  interval: number;
  handler: () => Promise<void>;
  lastRun?: Date;
  timerId?: ReturnType<typeof setInterval>;
}

const jobs: Job[] = [
  {
    name: 'cleanupDeletedFiles',
    interval: 60 * 60 * 1000, // 1 hour
    handler: cleanupDeletedFiles,
  },
  {
    name: 'cleanupExpiredRateLimits',
    interval: 5 * 60 * 1000, // 5 minutes
    handler: cleanupExpiredRateLimits,
  },
  {
    name: 'cleanupWebhookDeliveries',
    interval: 60 * 60 * 1000, // 1 hour
    handler: cleanupWebhookDeliveries,
  },
  {
    name: 'expireClaims',
    interval: 30 * 1000, // 30 seconds
    handler: expireClaims,
  },
];

async function runJob(job: Job): Promise<void> {
  try {
    await job.handler();
    job.lastRun = new Date();
  } catch (error) {
    console.error(`[Jobs] ${job.name} failed:`, error);
  }
}

export function startBackgroundJobs(): void {
  console.log('[Jobs] Starting background job scheduler...');

  for (const job of jobs) {
    void runJob(job);

    job.timerId = setInterval(() => void runJob(job), job.interval);
    console.log(`[Jobs] Scheduled ${job.name} every ${job.interval / 1000}s`);
  }
}

export function stopBackgroundJobs(): void {
  console.log('[Jobs] Stopping background job scheduler...');

  for (const job of jobs) {
    if (job.timerId) {
      clearInterval(job.timerId);
      job.timerId = undefined;
    }
  }
}

export function getJobStatus(): Array<{ name: string; interval: number; lastRun?: Date }> {
  return jobs.map((job) => ({
    name: job.name,
    interval: job.interval,
    lastRun: job.lastRun,
  }));
}

