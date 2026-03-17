/**
 * Human-in-the-Loop Workflow Integration Tests
 * 
 * Tests agent-human collaboration workflow:
 * 1. Agent creates draft
 * 2. Agent marks ready for review
 * 3. Human reads draft
 * 4. Human edits draft
 * 5. Human appends feedback
 * 6. Agent reads feedback
 * 7. Agent updates draft
 * 8. Verify complete interaction history
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('31 - Human-in-the-Loop Workflow', () => {
  let workspace: BootstrappedWorkspace;
  const DRAFT_PATH = '/__int_draft_proposal.md';
  const AGENT_AUTHOR = '__int_agent_gpt';
  const HUMAN_AUTHOR = '__int_human_reviewer';

  // Bootstrap workspace
  beforeAll(async () => {
    workspace = await bootstrap();
  });

  // 1. Agent creates draft file
  test('agent creates draft file', async () => {
    const draftContent = `# Project Proposal

## Summary
This proposal outlines the implementation of a new feature.

## Scope
- Feature A
- Feature B

## Timeline
TBD - pending review
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${DRAFT_PATH}`, {
      body: { content: draftContent },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 2. Agent marks ready for review
  test('agent marks draft ready for review', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${DRAFT_PATH}`, {
      body: {
        author: AGENT_AUTHOR,
        type: 'comment',
        content: 'Draft ready for human review. Please provide feedback on scope and timeline.',
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  // 3. Human can read draft via read key
  test('human can read draft via read key', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${DRAFT_PATH}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('Project Proposal');
    expect(data.data.content).toContain('TBD - pending review');
  });

  // 4. Human edits draft content
  test('human can edit draft', async () => {
    const updatedContent = `# Project Proposal

## Summary
This proposal outlines the implementation of a new feature.

## Scope
- Feature A
- Feature B
- Feature C (added by reviewer)

## Timeline
- Week 1-2: Design
- Week 3-4: Implementation
- Week 5: Testing
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${DRAFT_PATH}`, {
      body: { content: updatedContent },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 5. Human appends feedback
  test('human appends feedback comment', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${DRAFT_PATH}`, {
      body: {
        author: HUMAN_AUTHOR,
        type: 'comment',
        content: 'I have added Feature C to the scope and filled in the timeline. Please add cost estimates.',
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.author).toBe(HUMAN_AUTHOR);
  });

  // 6. Agent reads the updated draft with human changes
  test('agent reads human-edited draft', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${DRAFT_PATH}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('Feature C (added by reviewer)');
    expect(data.data.content).toContain('Week 1-2: Design');
  });

  // 7. Agent reads feedback from appends
  test('agent reads human feedback from appends', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${DRAFT_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Find human feedback
    const humanComment = data.data.appends.find((a: any) => a.author === HUMAN_AUTHOR);
    expect(humanComment).toBeDefined();
    expect(humanComment.content).toContain('cost estimates');
  });

  // 8. Agent incorporates feedback
  test('agent updates draft based on feedback', async () => {
    const finalContent = `# Project Proposal

## Summary
This proposal outlines the implementation of a new feature.

## Scope
- Feature A
- Feature B
- Feature C (added by reviewer)

## Timeline
- Week 1-2: Design
- Week 3-4: Implementation
- Week 5: Testing

## Cost Estimates
- Development: $15,000
- Testing: $5,000
- Total: $20,000
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${DRAFT_PATH}`, {
      body: { content: finalContent },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // Agent confirms update
  test('agent confirms update with comment', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${DRAFT_PATH}`, {
      body: {
        author: AGENT_AUTHOR,
        type: 'comment',
        content: 'Added cost estimates as requested. Proposal is now complete.',
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // Verify complete interaction history
  test('full interaction audit trail', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${DRAFT_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Should have at least 3 comments: agent ready, human feedback, agent confirm
    expect(data.data.appends.length).toBeGreaterThanOrEqual(3);

    // Verify both authors are present
    const authors = [...new Set(data.data.appends.map((a: any) => a.author))];
    expect(authors).toContain(AGENT_AUTHOR);
    expect(authors).toContain(HUMAN_AUTHOR);
  });

  // Verify final content
  test('final draft contains all updates', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${DRAFT_PATH}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('Cost Estimates');
    expect(data.data.content).toContain('$20,000');
    expect(data.data.content).toContain('Feature C');
  });
});

