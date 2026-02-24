/**
 * Research Handoff Workflow Integration Tests
 * 
 * Tests multi-agent research collaboration:
 * 1. Research agent creates findings file
 * 2. Research agent adds research notes
 * 3. Analysis agent reads findings
 * 4. Analysis agent adds analysis
 * 5. Summary agent creates final report
 * 6. Verify complete handoff chain
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('33 - Research Handoff Workflow', () => {
  let workspace: BootstrappedWorkspace;
  const RESEARCH_PATH = '/__int_research_findings.md';
  const REPORT_PATH = '/__int_final_report.md';
  const RESEARCH_AGENT = '__int_agent_researcher';
  const ANALYSIS_AGENT = '__int_agent_analyst';
  const SUMMARY_AGENT = '__int_agent_summarizer';

  // Bootstrap workspace
  beforeAll(async () => {
    workspace = await bootstrap();
  });

  // 1. Research agent creates findings file
  test('research agent creates findings file', async () => {
    const content = `# Research Findings

## Topic: Market Analysis

## Data Sources
- Source A
- Source B
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${RESEARCH_PATH}`, {
      body: { content },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 2. Research agent adds research notes
  test('research agent adds research notes', async () => {
    const notes = [
      'Market size: $50B globally',
      'Growth rate: 15% YoY',
      'Key competitors: Company X, Company Y',
    ];

    for (const note of notes) {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}${RESEARCH_PATH}`, {
        body: {
          author: RESEARCH_AGENT,
          type: 'comment',
          content: note,
        },
      });
      expect(response.status).toBe(201);
    }
  });

  // 3. Research agent marks handoff ready
  test('research agent marks handoff ready', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${RESEARCH_PATH}`, {
      body: {
        author: RESEARCH_AGENT,
        type: 'task',
        content: 'Research complete. Ready for analysis.',
        labels: ['handoff'],
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 4. Analysis agent reads findings
  test('analysis agent reads research findings', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${RESEARCH_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Should see research notes
    const researchNotes = data.data.appends.filter((a: any) => a.author === RESEARCH_AGENT);
    expect(researchNotes.length).toBeGreaterThanOrEqual(3);
  });

  // 5. Analysis agent claims handoff task
  test('analysis agent claims handoff task', async () => {
    // Find handoff task
    const listResp = await apiRequest('GET', `/r/${workspace.readKey}${RESEARCH_PATH}?format=parsed&appends=100`);
    const listData = await listResp.json();
    const handoffTask = listData.data.appends.find((a: any) =>
      a.type === 'task' && a.content.includes('Ready for analysis')
    );
    expect(handoffTask).toBeDefined();

    // Claim it
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${RESEARCH_PATH}`, {
      body: {
        author: ANALYSIS_AGENT,
        type: 'claim',
        ref: handoffTask.id,
      },
    });

    expect(response.status).toBe(201);
  });

  // 6. Analysis agent adds analysis
  test('analysis agent adds analysis', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${RESEARCH_PATH}`, {
      body: {
        author: ANALYSIS_AGENT,
        type: 'comment',
        content: 'Analysis: Market is growing rapidly. Recommend entry strategy focusing on underserved segments.',
      },
    });

    expect(response.status).toBe(201);
  });

  // 7. Summary agent creates final report
  test('summary agent creates final report', async () => {
    const reportContent = `# Final Report: Market Analysis

## Executive Summary
Based on research and analysis, market presents significant opportunity.

## Key Findings
- Market size: $50B
- Growth: 15% YoY
- Recommendation: Enter market via underserved segments

## Contributors
- Research: ${RESEARCH_AGENT}
- Analysis: ${ANALYSIS_AGENT}
- Summary: ${SUMMARY_AGENT}
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${REPORT_PATH}`, {
      body: { content: reportContent },
    });

    expect(response.status).toBe(201);
  });

  // 8. Summary agent links to research
  test('summary agent links to research', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${REPORT_PATH}`, {
      body: {
        author: SUMMARY_AGENT,
        type: 'comment',
        content: `Report generated from research at ${RESEARCH_PATH}`,
      },
    });

    expect(response.status).toBe(201);
  });

  // 9. Verify complete handoff chain
  test('complete handoff chain visible', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${RESEARCH_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();

    // Verify all agents participated
    const authors = [...new Set(data.data.appends.map((a: any) => a.author))];
    expect(authors).toContain(RESEARCH_AGENT);
    expect(authors).toContain(ANALYSIS_AGENT);
  });

  // 10. Final report is accessible
  test('final report is accessible', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${REPORT_PATH}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('Executive Summary');
    expect(data.data.content).toContain('$50B');
  });
});
