import { describe, expect, it } from 'vitest';
import { sep24Check } from '../src/checks/sep24.js';
import { CheckContext } from '../src/types.js';
import { VALID_SEP24_INFO } from './fixtures/mock-stellar-toml.js';

describe('SEP-0024 Diagnostic Check', () => {
  it('validates SEP-24 /info endpoint deposit and withdraw maps', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify(VALID_SEP24_INFO), {
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
      });

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {
        transferServerSep24Url: 'https://anchor.example.com/sep24',
      },
      fetchFn: mockFetch,
    };

    const findings = await sep24Check.run(context);
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(0);

    const depositPass = findings.find((f) => f.id === 'sep24-deposit-valid');
    expect(depositPass).toBeDefined();

    const withdrawPass = findings.find((f) => f.id === 'sep24-withdraw-valid');
    expect(withdrawPass).toBeDefined();
  });

  it('fails with error if /info response misses deposit map', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ fee: { enabled: true } }), {
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
      });

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {
        transferServerSep24Url: 'https://anchor.example.com/sep24',
      },
      fetchFn: mockFetch,
    };

    const findings = await sep24Check.run(context);
    const depositErr = findings.find((f) => f.id === 'sep24-deposit-missing');
    expect(depositErr).toBeDefined();
  });
});
