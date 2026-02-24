/**
 * Mock Webhook Receiver
 *
 * In-memory Express server for testing webhook delivery.
 * Replaces external Railway webhook receiver for integration tests.
 */

import express, { type Request, type Response } from 'express';
import type { Server } from 'node:http';

interface StoredEvent {
  testRunId?: string;
  timestamp: number;
  payload: unknown;
}

interface MockWebhookReceiver {
  url: string;
  stop: () => Promise<void>;
  getEvents: (testRunId?: string) => StoredEvent[];
  clearEvents: (testRunId?: string) => void;
}

/**
 * Start a mock webhook receiver on a random port.
 *
 * @returns MockWebhookReceiver with URL, stop, getEvents, and clearEvents methods
 */
export function startMockWebhookReceiver(): MockWebhookReceiver {
  const app = express();
  app.use(express.json());

  let server: Server | null = null;
  let events: StoredEvent[] = [];
  let currentPort = 0;

  // POST /ingest endpoint for webhook delivery
  app.post('/ingest', (req: Request, res: Response) => {
    const testRunId = req.query.testRunId as string | undefined;
    const timestamp = Date.now();

    console.log(`[WEBHOOK-RECEIVER] Received webhook (testRunId=${testRunId ?? 'none'})`);

    const event: StoredEvent = {
      testRunId,
      timestamp,
      payload: req.body,
    };

    events.push(event);
    res.status(200).json({ ok: true });
  });

  // GET /events endpoint to retrieve received webhooks
  app.get('/events', (req: Request, res: Response) => {
    const testRunId = req.query.testRunId as string | undefined;

    let filteredEvents = events;
    if (testRunId !== undefined) {
      filteredEvents = events.filter(e => e.testRunId === testRunId);
    }

    res.json(filteredEvents);
  });

  // DELETE /events endpoint to clear received webhooks
  app.delete('/events', (req: Request, res: Response) => {
    const testRunId = req.query.testRunId as string | undefined;

    if (testRunId !== undefined) {
      events = events.filter(e => e.testRunId !== testRunId);
      console.log(`[WEBHOOK-RECEIVER] Cleared events for testRunId=${testRunId}`);
    } else {
      events = [];
      console.log(`[WEBHOOK-RECEIVER] Cleared all events`);
    }

    res.status(200).json({ ok: true });
  });

  // Listen on random available port
  server = app.listen(0);
  const boundServer = server;
  const address = boundServer.address();
  if (!address || typeof address !== 'object' || typeof address.port !== 'number') {
    throw new Error('Mock webhook receiver failed to bind to a port');
  }
  currentPort = address.port;
  console.log(`[WEBHOOK-RECEIVER] Started on http://127.0.0.1:${String(currentPort)}`);

  const url = `http://127.0.0.1:${String(currentPort)}`;

  return {
    url,

    stop: async (): Promise<void> => {
      if (!server) {
        return;
      }

      const boundServer = server;

      return new Promise<void>((resolve) => {
        boundServer.close(() => {
          console.log(`[WEBHOOK-RECEIVER] Stopped`);
          server = null;
          currentPort = 0;
          resolve();
        });
      });
    },

    getEvents: (testRunId?: string): StoredEvent[] => {
      if (testRunId !== undefined) {
        return events.filter(e => e.testRunId === testRunId);
      }
      return [...events];
    },

    clearEvents: (testRunId?: string): void => {
      if (testRunId !== undefined) {
        events = events.filter(e => e.testRunId !== testRunId);
      } else {
        events = [];
      }
    },
  };
}
