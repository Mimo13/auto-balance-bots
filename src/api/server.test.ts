import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, AddressInfo } from 'node:net';
import http from 'node:http';

/**
 * Start the API server on a random port, call the test function,
 * then close the server.
 */
async function withServer(
  port: number,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  // Import dynamically so tests can run without the module installed
  const { startApi } = await import('./server.js');
  const server = await startApi(port);
  try {
    const addr = server.address() as AddressInfo;
    await fn(`http://localhost:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('API Server', () => {
  it('GET /health returns 200 with status ok', async () => {
    await withServer(0, async (baseUrl) => {
      const resp = await fetch(`${baseUrl}/health`);
      assert.equal(resp.status, 200);
      const body = await resp.json() as Record<string, unknown>;
      assert.equal(body.status, 'ok');
      assert.equal(typeof body.mode, 'string');
      assert.equal(typeof body.version, 'string');
    });
  });

  it('GET /api/advisor/report returns 200 with AdvisorReport shape', async () => {
    await withServer(0, async (baseUrl) => {
      const resp = await fetch(`${baseUrl}/api/advisor/report`);
      assert.equal(resp.status, 200);
      const body = await resp.json() as Record<string, unknown>;
      assert.equal(typeof body.generatedAt, 'string');
      assert.equal(typeof body.mode, 'string');
      assert.ok(Array.isArray(body.pairReports));
      assert.ok(body.portfolioRecommendation !== undefined);
    });
  });

  it('POST /api/advisor/preview accepts body and returns report', async () => {
    await withServer(0, async (baseUrl) => {
      const resp = await fetch(`${baseUrl}/api/advisor/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: ['BTCUSDC', 'ETHUSDC'],
          capital: 500,
        }),
      });
      assert.equal(resp.status, 200);
      const body = await resp.json() as Record<string, unknown>;
      assert.equal(typeof body.mode, 'string');
      assert.ok(Array.isArray(body.pairReports));
    });
  });

  it('POST /api/advisor/preview returns 400 on invalid JSON', async () => {
    await withServer(0, async (baseUrl) => {
      const resp = await fetch(`${baseUrl}/api/advisor/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      assert.equal(resp.status, 400);
    });
  });

  it('GET /unknown returns 404', async () => {
    await withServer(0, async (baseUrl) => {
      const resp = await fetch(`${baseUrl}/unknown`);
      assert.equal(resp.status, 404);
    });
  });
});
