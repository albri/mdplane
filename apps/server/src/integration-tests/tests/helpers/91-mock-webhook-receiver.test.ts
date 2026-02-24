import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startMockWebhookReceiver } from '../../helpers/mock-webhook-receiver';

describe('91 - Mock Webhook Receiver', () => {
  let receiver: ReturnType<typeof startMockWebhookReceiver>;

  beforeAll(() => {
    receiver = startMockWebhookReceiver();
    console.log(`Mock webhook receiver started at ${receiver.url}`);
  });

  afterAll(async () => {
    await receiver.stop();
  });

  describe('POST /ingest endpoint', () => {
    it('should accept webhook payload and return 200 OK', async () => {
      const payload = {
        event: 'test.event',
        timestamp: new Date().toISOString(),
        data: { message: 'test' },
      };

      const response = await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { ok: boolean };
      expect(data).toEqual({ ok: true });
    });

    it('should store received payload in memory', async () => {
      const payload = {
        event: 'test.event',
        timestamp: new Date().toISOString(),
      };

      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const events = receiver.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1].payload).toEqual(payload);
    });

    it('should store testRunId from query parameter', async () => {
      const testRunId = 'test-run-123';
      const payload = { event: 'test.event' };

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const events = receiver.getEvents();
      expect(events[events.length - 1].testRunId).toBe(testRunId);
    });
  });

  describe('GET /events endpoint', () => {
    it('should return all stored events', async () => {
      receiver.clearEvents();

      const payloads = [{ event: 'test1' }, { event: 'test2' }];
      for (const payload of payloads) {
        await fetch(`${receiver.url}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const response = await fetch(`${receiver.url}/events`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(data).toHaveLength(2);
    });

    it('should filter events by testRunId query parameter', async () => {
      receiver.clearEvents();

      const testRunId1 = 'run-1';
      const testRunId2 = 'run-2';

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event1' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId2}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event2' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event3' }),
      });

      const response = await fetch(`${receiver.url}/events?testRunId=${testRunId1}`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as { testRunId?: string }[];
      expect(data).toHaveLength(2);
      expect(data.every((e: { testRunId?: string }) => e.testRunId === testRunId1)).toBe(true);
    });

    it('should return empty array when no events match testRunId', async () => {
      const response = await fetch(`${receiver.url}/events?testRunId=nonexistent`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as unknown[];
      expect(data).toHaveLength(0);
    });
  });

  describe('DELETE /events endpoint', () => {
    it('should clear all events when no testRunId provided', async () => {
      const payload = { event: 'test.event' };

      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(receiver.getEvents().length).toBeGreaterThan(0);

      const response = await fetch(`${receiver.url}/events`, { method: 'DELETE' });
      expect(response.status).toBe(200);

      const data = (await response.json()) as { ok: boolean };
      expect(data).toEqual({ ok: true });

      expect(receiver.getEvents()).toHaveLength(0);
    });

    it('should clear only events matching testRunId', async () => {
      receiver.clearEvents();

      const testRunId1 = 'run-1';
      const testRunId2 = 'run-2';

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event1' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId2}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event2' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event3' }),
      });

      expect(receiver.getEvents()).toHaveLength(3);

      const response = await fetch(`${receiver.url}/events?testRunId=${testRunId1}`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as { ok: boolean };
      expect(data).toEqual({ ok: true });

      expect(receiver.getEvents()).toHaveLength(1);
      expect(receiver.getEvents()[0].testRunId).toBe(testRunId2);
    });
  });

  describe('getEvents method', () => {
    it('should return copy of events array', async () => {
      receiver.clearEvents();

      const payload = { event: 'test' };
      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const events1 = receiver.getEvents();
      const events2 = receiver.getEvents();

      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });

    it('should filter events by testRunId when provided', async () => {
      receiver.clearEvents();

      const testRunId = 'filter-test';
      const otherTestRunId = 'other-test';

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event1' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${otherTestRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event2' }),
      });

      const allEvents = receiver.getEvents();
      expect(allEvents.length).toBe(2);

      const filteredEvents = receiver.getEvents(testRunId);
      expect(filteredEvents.length).toBe(1);
      expect(filteredEvents[0].testRunId).toBe(testRunId);
    });
  });

  describe('clearEvents method', () => {
    it('should clear all events when no testRunId provided', async () => {
      const payload = { event: 'test' };
      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(receiver.getEvents().length).toBeGreaterThan(0);

      receiver.clearEvents();
      expect(receiver.getEvents()).toHaveLength(0);
    });

    it('should clear only events matching testRunId when provided', async () => {
      receiver.clearEvents();

      const testRunId = 'clear-test';
      const otherTestRunId = 'other-clear-test';

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event1' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${otherTestRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event2' }),
      });

      await fetch(`${receiver.url}/ingest?testRunId=${testRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event3' }),
      });

      expect(receiver.getEvents().length).toBe(3);

      receiver.clearEvents(testRunId);

      const remainingEvents = receiver.getEvents();
      expect(remainingEvents.length).toBe(1);
      expect(remainingEvents[0].testRunId).toBe(otherTestRunId);
    });
  });

  describe('stop method', () => {
    it('should close the Express server', async () => {
      const tempReceiver = startMockWebhookReceiver();
      const url = tempReceiver.url;

      await tempReceiver.stop();

      const response = await fetch(`${url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test' }),
      }).catch(() => ({ ok: false }));

      expect(response.ok).toBe(false);
    });

    it('should allow starting a new receiver after stop', async () => {
      const tempReceiver = startMockWebhookReceiver();
      await tempReceiver.stop();

      const newReceiver = startMockWebhookReceiver();
      const payload = { event: 'test' };

      const response = await fetch(`${newReceiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      await newReceiver.stop();
    });

    it('should allow multiple receivers concurrently', async () => {
      const r1 = startMockWebhookReceiver();
      const r2 = startMockWebhookReceiver();

      expect(r1.url).not.toBe(r2.url);

      await Promise.all([r1.stop(), r2.stop()]);
    });
  });

  describe('timestamp tracking', () => {
    it('should store timestamp for each event', async () => {
      receiver.clearEvents();

      const payload = { event: 'test' };
      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const events = receiver.getEvents();
      expect(events[0].timestamp).toBeGreaterThan(0);
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('should store timestamps in chronological order', async () => {
      receiver.clearEvents();

      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event1' }),
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await fetch(`${receiver.url}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'event2' }),
      });

      const events = receiver.getEvents();
      expect(events.length).toBe(2);
      expect(events[0].timestamp).toBeLessThan(events[1].timestamp);
    });
  });
});
