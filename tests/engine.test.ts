import { describe, expect, it } from 'vitest';
import { calculateGrade, calculateScore, DoctorEngine } from '../src/engine.js';
import {
  generateMockSep10Challenge,
  VALID_SEP24_INFO,
  VALID_SEP38_INFO,
  VALID_SEP6_INFO,
  VALID_STELLAR_TOML,
} from './fixtures/mock-stellar-toml.js';

describe('Doctor Engine & Scoring', () => {
  it('calculates score and grade accurately', () => {
    expect(calculateScore({ pass: 10, info: 2, warn: 0, error: 0, total: 12 })).toBe(100);
    expect(calculateGrade(100)).toBe('A+');

    expect(calculateScore({ pass: 10, info: 0, warn: 2, error: 0, total: 12 })).toBe(90);
    expect(calculateGrade(90)).toBe('A');

    expect(calculateScore({ pass: 10, info: 0, warn: 0, error: 2, total: 12 })).toBe(70);
    expect(calculateGrade(70)).toBe('C');

    expect(calculateScore({ pass: 0, info: 0, warn: 0, error: 10, total: 10 })).toBe(0);
    expect(calculateGrade(0)).toBe('F');
  });

  it('runs complete audit across all checks against mock anchor', async () => {
    const challengeXdr = generateMockSep10Challenge();

    const mockFetch: typeof fetch = async (input) => {
      const url = input.toString();

      if (url.includes('.well-known/stellar.toml')) {
        return new Response(VALID_STELLAR_TOML, {
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'text/plain; charset=utf-8',
            'strict-transport-security': 'max-age=31536000',
          },
        });
      }

      if (url.includes('/auth')) {
        return new Response(
          JSON.stringify({
            transaction: challengeXdr,
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

      if (url.includes('/sep24/info')) {
        return new Response(JSON.stringify(VALID_SEP24_INFO), {
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json',
          },
        });
      }

      if (url.includes('/sep38/info')) {
        return new Response(JSON.stringify(VALID_SEP38_INFO), {
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json',
          },
        });
      }

      if (url.includes('/sep6/info')) {
        return new Response(JSON.stringify(VALID_SEP6_INFO), {
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json',
          },
        });
      }

      return new Response('OK', { status: 200, headers: { 'access-control-allow-origin': '*' } });
    };

    const engine = new DoctorEngine();
    const report = await engine.runAudit({
      domain: 'anchor.example.com',
      fetchFn: mockFetch,
    });

    expect(report.domain).toBe('anchor.example.com');
    expect(report.summary.error).toBe(0);
    expect(report.summary.pass).toBeGreaterThan(10);
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.grade).toBe('A+');
  });
});
