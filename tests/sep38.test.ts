import { describe, expect, it } from 'vitest';
import { sep38Check } from '../src/checks/sep38.js';
import { CheckContext } from '../src/types.js';
import { VALID_SEP38_INFO } from './fixtures/mock-stellar-toml.js';

describe('SEP-0038 Diagnostic Check', () => {
  it('validates SEP-38 /info endpoint quote assets', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify(VALID_SEP38_INFO), {
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
        anchorQuoteServerUrl: 'https://anchor.example.com/sep38',
      },
      fetchFn: mockFetch,
    };

    const findings = await sep38Check.run(context);
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(0);

    const assetPass = findings.find((f) => f.id === 'sep38-assets-valid');
    expect(assetPass).toBeDefined();
  });

  it('fails if assets array is missing', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ notAssets: [] }), {
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
      });

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {
        anchorQuoteServerUrl: 'https://anchor.example.com/sep38',
      },
      fetchFn: mockFetch,
    };

    const findings = await sep38Check.run(context);
    const assetErr = findings.find((f) => f.id === 'sep38-assets-missing');
    expect(assetErr).toBeDefined();
  });
});
