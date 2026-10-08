import { describe, expect, it } from 'vitest';
import { sep10Check } from '../src/checks/sep10.js';
import { CheckContext } from '../src/types.js';
import { generateMockSep10Challenge } from './fixtures/mock-stellar-toml.js';

describe('SEP-0010 Diagnostic Check', () => {
  it('passes on valid SEP-10 challenge transaction with sequence 0 and timebounds', async () => {
    const challengeXdr = generateMockSep10Challenge();

    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          transaction: challengeXdr,
          network_passphrase: 'Public Global Stellar Network ; September 2015',
        }),
        {
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json',
          },
        }
      );

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {
        authServerUrl: 'https://anchor.example.com/auth',
      },
      fetchFn: mockFetch,
    };

    const findings = await sep10Check.run(context);

    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(0);

    const passed = findings.filter((f) => f.severity === 'pass');
    expect(passed.length).toBeGreaterThanOrEqual(4);
  });

  it('handles absent AUTH_SERVER gracefully with info severity', async () => {
    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {},
    };

    const findings = await sep10Check.run(context);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].id).toBe('sep10-not-configured');
  });

  it('fails with error if AUTH_SERVER returns HTTP 500', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {
        authServerUrl: 'https://anchor.example.com/auth',
      },
      fetchFn: mockFetch,
    };

    const findings = await sep10Check.run(context);
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].id).toBe('sep10-endpoint-fail');
  });
});
