import { describe, expect, it } from 'vitest';
import { sep10Check, TEST_CLIENT_DOMAIN } from '../src/checks/sep10.js';
import { CheckContext } from '../src/types.js';
import { generateMockSep10Challenge } from './fixtures/mock-stellar-toml.js';

const AUTH_URL = 'https://anchor.example.com/auth';

function createContext(fetchFn: typeof fetch): CheckContext {
  return {
    domain: 'anchor.example.com',
    isTestnet: false,
    timeoutMs: 5000,
    skipChecks: [],
    endpoints: {
      authServerUrl: AUTH_URL,
    },
    fetchFn,
  };
}

function challengeResponse(transaction: string): Response {
  return new Response(
    JSON.stringify({
      transaction,
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
}

function isClientDomainRequest(url: string): boolean {
  return new URL(url).searchParams.has('client_domain');
}

describe('SEP-0010 Diagnostic Check', () => {
  it('passes on valid SEP-10 challenge transaction with sequence 0 and timebounds', async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = input.toString();
      return challengeResponse(
        generateMockSep10Challenge(
          isClientDomainRequest(url) ? { clientDomain: TEST_CLIENT_DOMAIN } : {}
        )
      );
    };

    const findings = await sep10Check.run(createContext(mockFetch));

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

    const findings = await sep10Check.run(createContext(mockFetch));
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].id).toBe('sep10-endpoint-fail');
  });

  describe('client_domain challenge handling', () => {
    it('requests a challenge with client_domain and accepts a matching Manage Data operation', async () => {
      const requestedUrls: string[] = [];

      const mockFetch: typeof fetch = async (input) => {
        const url = input.toString();
        requestedUrls.push(url);
        return challengeResponse(
          generateMockSep10Challenge(
            isClientDomainRequest(url) ? { clientDomain: TEST_CLIENT_DOMAIN } : {}
          )
        );
      };

      const findings = await sep10Check.run(createContext(mockFetch));

      const clientDomainRequests = requestedUrls.filter(isClientDomainRequest);
      expect(clientDomainRequests).toHaveLength(1);
      expect(new URL(clientDomainRequests[0]).searchParams.get('client_domain')).toBe(
        TEST_CLIENT_DOMAIN
      );
      // The default challenge still omits the optional parameter.
      expect(
        requestedUrls.filter((url) => !isClientDomainRequest(url)).length
      ).toBeGreaterThan(0);

      const pass = findings.find((f) => f.id === 'sep10-client-domain-valid');
      expect(pass).toBeDefined();
      expect(pass?.severity).toBe('pass');
      expect(pass?.message).toContain(TEST_CLIENT_DOMAIN);
      expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
    });

    it('warns when the requested client_domain operation is missing from the challenge', async () => {
      const mockFetch: typeof fetch = async () =>
        challengeResponse(generateMockSep10Challenge());

      const findings = await sep10Check.run(createContext(mockFetch));

      const missing = findings.find((f) => f.id === 'sep10-client-domain-missing');
      expect(missing).toBeDefined();
      expect(missing?.severity).toBe('warn');
      expect(findings.find((f) => f.id === 'sep10-client-domain-valid')).toBeUndefined();
      expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
    });

    it('errors when the client_domain operation value does not match the request', async () => {
      const mockFetch: typeof fetch = async (input) => {
        const url = input.toString();
        return challengeResponse(
          generateMockSep10Challenge(
            isClientDomainRequest(url)
              ? { clientDomain: TEST_CLIENT_DOMAIN, clientDomainValue: 'other-wallet.example' }
              : {}
          )
        );
      };

      const findings = await sep10Check.run(createContext(mockFetch));

      const mismatch = findings.find((f) => f.id === 'sep10-client-domain-value-mismatch');
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe('error');
      expect(mismatch?.message).toContain('other-wallet.example');
      expect(mismatch?.message).toContain(TEST_CLIENT_DOMAIN);
      expect(findings.find((f) => f.id === 'sep10-client-domain-valid')).toBeUndefined();
    });

    it('errors when the client_domain operation falls back to the server account', async () => {
      const mockFetch: typeof fetch = async (input) => {
        const url = input.toString();
        return challengeResponse(
          generateMockSep10Challenge(
            isClientDomainRequest(url)
              ? { clientDomain: TEST_CLIENT_DOMAIN, clientDomainWithoutSource: true }
              : {}
          )
        );
      };

      const findings = await sep10Check.run(createContext(mockFetch));

      const source = findings.find((f) => f.id === 'sep10-client-domain-source');
      expect(source).toBeDefined();
      expect(source?.severity).toBe('error');
      expect(source?.message).toContain('no source account');
      expect(findings.find((f) => f.id === 'sep10-client-domain-valid')).toBeUndefined();
    });

    it('reports an inconclusive probe as info when the unresolvable domain is rejected', async () => {
      const mockFetch: typeof fetch = async (input) => {
        if (isClientDomainRequest(input.toString())) {
          return new Response(
            JSON.stringify({ error: 'Unable to fetch client domain stellar.toml' }),
            {
              status: 400,
              statusText: 'Bad Request',
              headers: { 'content-type': 'application/json' },
            }
          );
        }
        return challengeResponse(generateMockSep10Challenge());
      };

      const findings = await sep10Check.run(createContext(mockFetch));

      const rejected = findings.find((f) => f.id === 'sep10-client-domain-rejected');
      expect(rejected).toBeDefined();
      expect(rejected?.severity).toBe('info');
      expect(rejected?.message).toContain('HTTP 400');
      expect(rejected?.message).toContain('Unable to fetch client domain stellar.toml');
      expect(findings.filter((f) => f.severity === 'error')).toHaveLength(0);
    });

    it('warns when the client_domain request fails unexpectedly', async () => {
      const mockFetch: typeof fetch = async (input) => {
        if (isClientDomainRequest(input.toString())) {
          return new Response('Internal Server Error', {
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        return challengeResponse(generateMockSep10Challenge());
      };

      const findings = await sep10Check.run(createContext(mockFetch));

      const rejected = findings.find((f) => f.id === 'sep10-client-domain-rejected');
      expect(rejected).toBeDefined();
      expect(rejected?.severity).toBe('warn');
      expect(rejected?.message).toContain('HTTP 500');
    });

    it('does not request client_domain on the default challenge and flags an unrequested operation', async () => {
      const requestedUrls: string[] = [];

      const mockFetch: typeof fetch = async (input) => {
        const url = input.toString();
        requestedUrls.push(url);
        // The server always attaches the operation, even when it was not requested.
        return challengeResponse(generateMockSep10Challenge({ clientDomain: TEST_CLIENT_DOMAIN }));
      };

      const findings = await sep10Check.run(createContext(mockFetch));

      const unexpected = findings.find((f) => f.id === 'sep10-client-domain-unexpected');
      expect(unexpected).toBeDefined();
      expect(unexpected?.severity).toBe('warn');
      expect(unexpected?.message).toContain('without client_domain');
    });

    it('documents the limits of structural client_domain validation', async () => {
      const mockFetch: typeof fetch = async (input) =>
        challengeResponse(
          generateMockSep10Challenge(
            isClientDomainRequest(input.toString()) ? { clientDomain: TEST_CLIENT_DOMAIN } : {}
          )
        );

      const findings = await sep10Check.run(createContext(mockFetch));

      const limits = findings.find((f) => f.id === 'sep10-client-domain-limits');
      expect(limits).toBeDefined();
      expect(limits?.severity).toBe('info');
      expect(limits?.message).toContain('No client-domain signing key');
      expect(limits?.message).toContain('no signature was verified');
    });
  });
});
