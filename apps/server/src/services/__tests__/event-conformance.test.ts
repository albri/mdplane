import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

/**
 * Extract event type literals from TypeScript union type file.
 * Parses the source code to get actual values - no hardcoding.
 */
function extractEventTypesFromSource(
  filePath: string,
  typeName: string
): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match: export type TypeName = 'a' | 'b' | 'c';
  // Handles multi-line definitions
  const typeRegex = new RegExp(
    `export type ${typeName}\\s*=\\s*([^;]+);`,
    's'
  );
  const match = content.match(typeRegex);
  if (!match) {
    throw new Error(`Could not find type ${typeName} in ${filePath}`);
  }

  // Extract all string literals from the union
  const literalRegex = /'([^']+)'/g;
  const literals: string[] = [];
  let literalMatch;
  while ((literalMatch = literalRegex.exec(match[1])) !== null) {
    literals.push(literalMatch[1]);
  }

  if (literals.length === 0) {
    throw new Error(`No literals found for type ${typeName} in ${filePath}`);
  }

  return literals;
}

describe('Realtime Event Conformance', () => {
  // Paths relative to this test file
  const openApiRealtimePath = path.resolve(
    __dirname,
    '../../../../../packages/shared/openapi/components/schemas/realtime.yaml'
  );
  const openApiWebhooksPath = path.resolve(
    __dirname,
    '../../../../../packages/shared/openapi/components/schemas/webhooks.yaml'
  );
  const eventBusPath = path.resolve(__dirname, '../event-bus.ts');
  const webhookTriggerPath = path.resolve(__dirname, '../webhook-trigger.ts');

  test('all WebSocketEvent enum values are wired in server EventType', () => {
    // Read OpenAPI spec
    const spec = yaml.parse(fs.readFileSync(openApiRealtimePath, 'utf-8'));
    const openApiEvents: string[] = spec.WebSocketEvent.enum;

    // Extract EventType from source (no hardcoding)
    const serverEventTypes = extractEventTypesFromSource(
      eventBusPath,
      'EventType'
    );

    // Reserved events (documented in OpenAPI but intentionally not emitted yet)
    const reservedEvents: string[] = [];

    // Check: every OpenAPI event is either in server or reserved
    for (const event of openApiEvents) {
      const isInServer = serverEventTypes.includes(event);
      const isReserved = reservedEvents.includes(event);

      expect(
        isInServer || isReserved,
        `OpenAPI WebSocketEvent '${event}' is not wired in server EventType and not marked as reserved`
      ).toBe(true);
    }

    // Check: server doesn't emit events not in OpenAPI
    for (const event of serverEventTypes) {
      expect(
        openApiEvents.includes(event),
        `Server EventType '${event}' is not defined in OpenAPI WebSocketEvent enum`
      ).toBe(true);
    }
  });

  test('all WebhookEvent enum values are wired in server', () => {
    // Read OpenAPI spec
    const spec = yaml.parse(fs.readFileSync(openApiWebhooksPath, 'utf-8'));
    const openApiEvents: string[] = spec.WebhookEvent.enum;

    // Extract WebhookEventType from source (no hardcoding)
    const webhookEventTypes = extractEventTypesFromSource(
      webhookTriggerPath,
      'WebhookEventType'
    );

    // Reserved webhook events (in server but not in OpenAPI spec yet)
    const reservedWebhookEvents: string[] = [
      'workspace.claimed', // Emitted by server but not in WebhookEvent enum yet
    ];

    // Check: every OpenAPI event is in server
    for (const event of openApiEvents) {
      const isInServer = webhookEventTypes.includes(event);

      expect(
        isInServer,
        `OpenAPI WebhookEvent '${event}' is not wired in server WebhookEventType`
      ).toBe(true);
    }

    // Check: server doesn't emit events not in OpenAPI (except reserved)
    for (const event of webhookEventTypes) {
      const isInOpenApi = openApiEvents.includes(event);
      const isReserved = reservedWebhookEvents.includes(event);

      expect(
        isInOpenApi || isReserved,
        `Server WebhookEventType '${event}' is not defined in OpenAPI WebhookEvent enum and not marked as reserved`
      ).toBe(true);
    }
  });
});

