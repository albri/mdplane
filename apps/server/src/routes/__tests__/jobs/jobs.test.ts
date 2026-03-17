/**
 * Job Polling Endpoint Tests
 *
 * @see packages/shared/openapi/paths/jobs.yaml
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

// Import the route under test
import { jobsRoute } from '../../jobs';
import {
  resetJobsTestData,
  TEST_COMPLETED_JOB_KEY,
  TEST_FAILED_JOB_KEY,
  TEST_PENDING_JOB_KEY,
  TEST_PROCESSING_JOB_KEY,
} from '../fixtures/jobs-fixtures';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Valid job poll keys (will be set up in test fixtures)
const VALID_PENDING_JOB_KEY = TEST_PENDING_JOB_KEY;
const VALID_PROCESSING_JOB_KEY = TEST_PROCESSING_JOB_KEY;
const VALID_COMPLETED_JOB_KEY = TEST_COMPLETED_JOB_KEY;
const VALID_FAILED_JOB_KEY = TEST_FAILED_JOB_KEY;
const INVALID_JOB_KEY = 'short';
const NONEXISTENT_JOB_KEY = 'job_nonexistent_key12345678';

// Pattern matching for response validation
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('Job Polling', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with jobs route
    app = new Elysia().use(jobsRoute);
  });

  beforeEach(() => {
    // Reset test fixtures before each test
    resetJobsTestData();
  });

  describe('GET /j/:key - Poll Job Status', () => {
    describe('Successful Responses', () => {
      test('should return 200 for valid pending job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_PENDING_JOB_KEY}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'JobResponse');
      });

      test('should return job id in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_PENDING_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.id).toBeDefined();
        expect(typeof body.data.id).toBe('string');
      });

      test('should return status as pending for pending job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_PENDING_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.status).toBe('pending');
      });

      test('should return status as processing for processing job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_PROCESSING_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.status).toBe('processing');
      });

      test('should return status as completed for completed job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_COMPLETED_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.status).toBe('completed');
      });

      test('should return status as failed for failed job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_FAILED_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.status).toBe('failed');
      });

      test('should return createdAt timestamp', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_PENDING_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should return progress for processing job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_PROCESSING_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.progress).toBeDefined();
        expect(typeof body.data.progress.current).toBe('number');
        expect(typeof body.data.progress.total).toBe('number');
      });

      test('should return result for completed job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_COMPLETED_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.result).toBeDefined();
      });

      test('should return completedAt for completed job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_COMPLETED_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.completedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should return error details for failed job', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${VALID_FAILED_JOB_KEY}`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.error).toBeDefined();
        expect(body.data.error.code).toBeDefined();
        expect(body.data.error.message).toBeDefined();
      });
    });

    describe('Error Responses', () => {
      test('should return 404 for nonexistent job key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${NONEXISTENT_JOB_KEY}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('JOB_NOT_FOUND');
      });

      test('should return 404 for invalid key format', async () => {
        const response = await app.handle(
          new Request(`http://localhost/j/${INVALID_JOB_KEY}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });
  });

});


