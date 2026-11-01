import { describe, expect, it } from 'vitest';
import { sep31Check } from '../src/checks/sep31.js';
import { CheckContext } from '../src/types.js';
import { VALID_SEP31_INFO } from './fixtures/mock-stellar-toml.js';

function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    domain: 'anchor.example.com',
    isTestnet: false,
    timeoutMs: 5000,
    skipChecks: [],
    endpoints: {},
    fetchFn: async () =>
      new Response(JSON.stringify(VALID_SEP31_INFO), {
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
      }),
    ...overrides,
  };
}

describe('SEP-0031 Diagnostic Check', () => {
  it('validates SEP-31 /info endpoint deposit, withdraw, fields, and CORS', async () => {
    const context = makeContext({
      endpoints: {
        directPaymentServerUrl: 'https://anchor.example.com/sep31',
      },
    });

    const findings = await sep31Check.run(context);
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(0);

    expect(findings.find((f) => f.id === 'sep31-info-online')).toBeDefined();
    expect(findings.find((f) => f.id === 'sep31-cors' && f.severity === 'pass')).toBeDefined();
    expect(findings.find((f) => f.id === 'sep31-deposit-valid')).toBeDefined();
    expect(findings.find((f) => f.id === 'sep31-withdraw-valid')).toBeDefined();
    expect(findings.find((f) => f.id === 'sep31-fields-valid')).toBeDefined();
    expect(findings.find((f) => f.id === 'sep31-fee-valid')).toBeDefined();
  });

  it('reports info when DIRECT_PAYMENT_SERVER is not configured', async () => {
    const context = makeContext({ endpoints: {} });
    const findings = await sep31Check.run(context);
    const notice = findings.find((f) => f.id === 'sep31-not-configured');
    expect(notice).toBeDefined();
    expect(notice?.severity).toBe('info');
  });

  it('fails with error when /info is unreachable', async () => {
    const context = makeContext({
      endpoints: {
        directPaymentServerUrl: 'https://anchor.example.com/sep31',
      },
      fetchFn: async () =>
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    });

    const findings = await sep31Check.run(context);
    const err = findings.find((f) => f.id === 'sep31-info-fail');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  it('warns when CORS wildcard is missing', async () => {
    const context = makeContext({
      endpoints: {
        directPaymentServerUrl: 'https://anchor.example.com/sep31',
      },
      fetchFn: async () =>
        new Response(JSON.stringify(VALID_SEP31_INFO), {
          status: 200,
          headers: {
            'access-control-allow-origin': 'https://internal.example.com',
          },
        }),
    });

    const findings = await sep31Check.run(context);
    const warn = findings.find((f) => f.id === 'sep31-cors' && f.severity === 'warn');
    expect(warn).toBeDefined();
  });

  it('reports error when /info returns invalid JSON', async () => {
    const context = makeContext({
      endpoints: {
        directPaymentServerUrl: 'https://anchor.example.com/sep31',
      },
      fetchFn: async () =>
        new Response('not json', {
          status: 200,
          headers: { 'access-control-allow-origin': '*' },
        }),
    });

    const findings = await sep31Check.run(context);
    const err = findings.find((f) => f.id === 'sep31-json-invalid');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  it('reports warning when deposit map is missing', async () => {
    const context = makeContext({
      endpoints: {
        directPaymentServerUrl: 'https://anchor.example.com/sep31',
      },
      fetchFn: async () =>
        new Response(JSON.stringify({ withdraw: { USDC: { enabled: true } } }), {
          status: 200,
          headers: { 'access-control-allow-origin': '*' },
        }),
    });

    const findings = await sep31Check.run(context);
    const warn = findings.find((f) => f.id === 'sep31-deposit-missing');
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe('warn');
  });

  it('reports info when transaction fields array is missing', async () => {
    const context = makeContext({
      endpoints: {
        directPaymentServerUrl: 'https://anchor.example.com/sep31',
      },
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            deposit: { USDC: { enabled: true } },
            withdraw: { USDC: { enabled: true } },
          }),
          { status: 200, headers: { 'access-control-allow-origin': '*' } }
        ),
    });

    const findings = await sep31Check.run(context);
    const info = findings.find((f) => f.id === 'sep31-fields-missing');
    expect(info).toBeDefined();
    expect(info?.severity).toBe('info');
  });
});
