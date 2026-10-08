import { describe, expect, it } from 'vitest';
import { sep1Check } from '../src/checks/sep1.js';
import { CheckContext } from '../src/types.js';
import { VALID_STELLAR_TOML } from './fixtures/mock-stellar-toml.js';

describe('SEP-0001 Diagnostic Check', () => {
  it('passes on valid stellar.toml with CORS and valid signing key', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(VALID_STELLAR_TOML, {
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'text/plain; charset=utf-8',
        },
      });

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {},
      fetchFn: mockFetch,
    };

    const findings = await sep1Check.run(context);

    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(0);

    const passed = findings.filter((f) => f.severity === 'pass');
    expect(passed.length).toBeGreaterThanOrEqual(4);

    expect(context.endpoints.authServerUrl).toBe('https://anchor.example.com/auth');
    expect(context.endpoints.transferServerSep24Url).toBe('https://anchor.example.com/sep24');
    expect(context.endpoints.anchorQuoteServerUrl).toBe('https://anchor.example.com/sep38');
  });

  it('reports error when stellar.toml is inaccessible (404)', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      });

    const context: CheckContext = {
      domain: 'invalid.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {},
      fetchFn: mockFetch,
    };

    const findings = await sep1Check.run(context);
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].id).toBe('sep1-missing');
  });

  it('warns when CORS wildcard is missing', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(VALID_STELLAR_TOML, {
        status: 200,
        headers: {
          'access-control-allow-origin': 'https://internal.example.com',
          'content-type': 'text/plain',
        },
      });

    const context: CheckContext = {
      domain: 'anchor.example.com',
      isTestnet: false,
      timeoutMs: 5000,
      skipChecks: [],
      endpoints: {},
      fetchFn: mockFetch,
    };

    const findings = await sep1Check.run(context);
    const corsWarn = findings.find((f) => f.id === 'sep1-cors' && f.severity === 'warn');
    expect(corsWarn).toBeDefined();
  });
});
