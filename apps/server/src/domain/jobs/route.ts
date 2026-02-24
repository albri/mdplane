import { Elysia } from 'elysia';
import { zPollJobStatusResponse, zError } from '@mdplane/shared';
import type { Job, JobError, JobProgress, JobStatus } from './types';
import {
  getJobByKey,
  isJobExpired,
  toJobPollResponseData,
  validateJobKeyFormat,
} from './handlers';

export {
  createJob,
  getJobById,
  updateJob,
} from './handlers';

export const jobsRoute = new Elysia()
  .get('/j/:key', async ({ params, set }) => {
    const { key } = params;

    if (!validateJobKeyFormat(key)) {
      set.status = 404;
      return {
        ok: false as const,
        error: {
          code: 'JOB_NOT_FOUND' as const,
          message: 'Job not found or expired',
        },
      };
    }

    const job = getJobByKey(key);
    if (!job) {
      set.status = 404;
      return {
        ok: false as const,
        error: {
          code: 'JOB_NOT_FOUND' as const,
          message: 'Job not found or expired',
        },
      };
    }

    if (isJobExpired(job)) {
      set.status = 404;
      return {
        ok: false as const,
        error: {
          code: 'JOB_NOT_FOUND' as const,
          message: 'Job not found or expired',
        },
      };
    }

    set.status = 200;
    return {
      ok: true as const,
      data: toJobPollResponseData(job),
    };
  }, {
    response: {
      200: zPollJobStatusResponse,
      404: zError,
    },
  });

