// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { QLT_PROPOSAL_FIELD_GUIDANCE } from '../src/lib/agent/proposal-guidance';
import { proposalDraftInputContract } from '../src/lib/agent/proposal-capability';
import {
  argumentEvidence,
  installProviderObserver,
  simulatedResponse,
} from '../scripts/lib/q6-provider-observer.mjs';

describe('Q6 installed provider boundary (network disabled)', () => {
  it('keeps model field guidance aligned with the unchanged closed schema enums', () => {
    const schema = proposalDraftInputContract.descriptiveJsonSchema as any;
    for (const branch of schema.oneOf) {
      for (const [name, field] of Object.entries(branch.properties.content.properties) as any) {
        if (!field.enum) continue;
        expect(QLT_PROPOSAL_FIELD_GUIDANCE).toContain(`content.${name}`);
        for (const value of field.enum) expect(QLT_PROPOSAL_FIELD_GUIDANCE).toContain(value);
      }
    }
  });
  it('runs the complete ceremony through the real provider transport adapter without network', () => {
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/q6-provider-probe.mjs', 'matrix'],
      {
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, OLLAMA_API_KEY: '', QUELLIGHT_DIAGNOSTIC: '' },
      },
    );
    expect(child.status).toBe(0);
    const [probe, privacy, cleanup] = child.stdout.trim().split('\n').map(JSON.parse);
    expect(probe.guidancePresent).toBe(true);
    expect(probe.result.ok).toBe(true);
    expect(probe.result.findings).toEqual([]);
    expect(probe.result.providerTurns).toBe(6);
    expect(probe.result.providerRequests).toHaveLength(8);
    expect(
      probe.result.providerRequests.every(
        (request) => !request.rewritten && request.schemaUnchanged,
      ),
    ).toBe(true);
    expect(probe.result.turns.map((turn) => turn.invocations)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(privacy.credentialOccurrences).toBe(0);
    expect(cleanup.cleanupRemoved).toBe(true);
  });
  for (const scenario of ['valid', 'invalid', 'length']) {
    it(`traverses the real router, validator, governed bridge and restore: ${scenario}`, () => {
      const child = spawnSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/q6-provider-probe.mjs', scenario],
        {
          encoding: 'utf8',
          timeout: 60_000,
          env: { ...process.env, OLLAMA_API_KEY: '', QUELLIGHT_DIAGNOSTIC: '' },
        },
      );
      expect(child.status).toBe(0);
      const [probe, privacy, cleanup] = child.stdout.trim().split('\n').map(JSON.parse);
      expect(privacy).toMatchObject({ workerExit: 0, credentialOccurrences: 0, outputSafe: true });
      expect(cleanup.cleanupRemoved).toBe(true);
      expect(probe.rawRouterEqual).toBe(true);
      expect(probe.requests.every((request) => request.schemaUnchanged)).toBe(true);
      expect(probe.evidence.canonical).toBe(0);
      if (scenario === 'length') {
        expect(probe.requests).toHaveLength(1);
        expect(probe.requests[0]).toMatchObject({
          finish: 'length',
          contentBytes: 0,
          toolDeltas: 0,
        });
        expect(probe.evidence.visibleReplyBytes).toBe(0);
      } else {
        expect(probe.requests).toHaveLength(2);
        const args = probe.requests[0].arguments[0];
        expect(args).toMatchObject({
          json: true,
          guard: 'accepted',
          normalizationChanged: false,
          mastraAccepted: scenario === 'valid',
          contractAccepted: scenario === 'valid',
        });
        expect(probe.evidence.proposals).toHaveLength(scenario === 'valid' ? 1 : 0);
        expect(probe.evidence.invocations).toHaveLength(scenario === 'valid' ? 1 : 0);
        expect(probe.evidence.visibleReplyBytes).toBeGreaterThan(0);
        if (scenario === 'invalid') {
          expect(args.issues.map((issue) => issue.path)).toEqual([
            'content.epistemicType',
            'content.honestyState',
            'content.confidence',
          ]);
          expect(probe.evidence.milestones).toContainEqual({
            kind: 'tool.failed',
            code: 'VICT_TOOL_FAILED',
          });
        }
      }
    });
  }

  it('refuses request overflow before transport and never includes payload values in evidence', async () => {
    let calls = 0;
    const observer = installProviderObserver({
      maxRequests: 1,
      purpose: 'offline-cap',
      transport: async () => {
        calls++;
        return simulatedResponse('length');
      },
    });
    try {
      const request = () =>
        fetch('https://ollama.com/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({
            max_tokens: 512,
            messages: [{ role: 'user', content: 'PRIVATE-CANARY' }],
          }),
        });
      await (await request()).text();
      await expect(request()).rejects.toThrow('QLT_DIAGNOSTIC_REQUEST_CAP');
      expect(calls).toBe(1);
      expect(observer.refused).toBe(1);
      expect(JSON.stringify(observer.records)).not.toContain('PRIVATE-CANARY');
      const evidence = argumentEvidence(
        JSON.stringify({ proposalKind: 'PRIVATE-CANARY', 'PRIVATE-KEY': 'PRIVATE-CANARY' }),
      );
      expect(evidence.json).toBe(true);
      expect(JSON.stringify(evidence)).not.toContain('PRIVATE');
    } finally {
      observer.restore();
    }
  });

  it('enforces the per-turn request ceiling independently of the total ceiling', async () => {
    let calls = 0;
    let purpose = 'first';
    const observer = installProviderObserver({
      maxRequests: 12,
      maxRequestsPerTurn: 1,
      maxTokens: 2048,
      purpose: () => purpose,
      transport: async () => {
        calls++;
        return simulatedResponse('text');
      },
    });
    const request = () =>
      fetch('https://ollama.com/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ max_tokens: 2048 }),
      });
    try {
      await (await request()).text();
      await expect(request()).rejects.toThrow('QLT_DIAGNOSTIC_TURN_BOUND');
      purpose = 'second';
      await (await request()).text();
      expect(calls).toBe(2);
      expect(observer.records.map((row) => row.purpose)).toEqual(['first', 'second']);
    } finally {
      observer.restore();
    }
  });

  it('aborts a stalled transport within the shared turn deadline', async () => {
    const observer = installProviderObserver({
      maxRequests: 1,
      turnDeadlineMs: 20,
      purpose: 'deadline',
      transport: async (_url, init) =>
        new Promise((_resolve, reject) => {
          if (init.signal.aborted) reject(new Error('synthetic'));
          else
            init.signal.addEventListener('abort', () => reject(new Error('synthetic')), {
              once: true,
            });
        }),
    });
    try {
      await expect(
        fetch('https://ollama.com/v1/chat/completions', { method: 'POST', body: '{}' }),
      ).rejects.toThrow('QLT_DIAGNOSTIC_TRANSPORT_FAILED');
      expect(observer.records[0].transportFailed).toBe(true);
    } finally {
      observer.restore();
    }
  }, 2_000);
});
