const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createConfig, maskMongoUri, parsePort } = require('../src/config/index');
const environment = require('../src/config/environment');
const { MemoryStore } = require('../src/data/memoryStore');

describe('Phase 21 — Centralized Configuration & Environment Hardening Test Suite', () => {

  describe('1. Port Parsing & Validation', () => {
    it('parses valid numeric port strings correctly', () => {
      assert.strictEqual(parsePort('3000'), 3000);
      assert.strictEqual(parsePort('8080'), 8080);
      assert.strictEqual(parsePort(5000), 5000);
    });

    it('falls back to default port when non-numeric, negative, or out-of-range', () => {
      assert.strictEqual(parsePort('invalid'), 5000);
      assert.strictEqual(parsePort('-10'), 5000);
      assert.strictEqual(parsePort('0'), 5000);
      assert.strictEqual(parsePort('70000'), 5000);
      assert.strictEqual(parsePort(null, 4000), 4000);
    });
  });

  describe('2. Secret Masking & Redaction', () => {
    it('masks password in standard MongoDB connection strings', () => {
      const raw = 'mongodb://app_user:SuperSecretPassword123@localhost:27017/uyirkappan';
      const masked = maskMongoUri(raw);
      assert.strictEqual(masked.includes('SuperSecretPassword123'), false);
      assert.ok(masked.includes('*****'));
      assert.ok(masked.includes('app_user'));
      assert.ok(masked.includes('localhost:27017'));
    });

    it('masks password in mongodb+srv protocol URIs', () => {
      const raw = 'mongodb+srv://admin_cluster:TopSecretKey987@cluster0.mongodb.net/uyirkappan_prod?retryWrites=true';
      const masked = maskMongoUri(raw);
      assert.strictEqual(masked.includes('TopSecretKey987'), false);
      assert.ok(masked.includes('*****'));
      assert.ok(masked.includes('admin_cluster'));
    });

    it('handles empty or credential-free URIs gracefully', () => {
      assert.strictEqual(maskMongoUri(''), '');
      const noCreds = 'mongodb://localhost:27017/uyirkappan';
      assert.strictEqual(maskMongoUri(noCreds), noCreds);
    });
  });

  describe('3. Authoritative Config Factory Defaults & Grouping', () => {
    it('builds frozen config with safe defaults in dev/test', () => {
      const cfg = createConfig({
        NODE_ENV: 'test',
      });

      assert.ok(Object.isFrozen(cfg));
      assert.ok(Object.isFrozen(cfg.server));
      assert.ok(Object.isFrozen(cfg.database));
      assert.ok(Object.isFrozen(cfg.traffic));
      assert.ok(Object.isFrozen(cfg.auth));
      assert.ok(Object.isFrozen(cfg.dispatch));
      assert.ok(Object.isFrozen(cfg.routing));

      assert.strictEqual(cfg.server.port, 5000);
      assert.strictEqual(cfg.database.mode, 'memory');
      assert.strictEqual(cfg.database.isMemory, true);
      assert.strictEqual(cfg.database.isMongo, false);
      assert.strictEqual(cfg.dispatch.requireOnlineDriver, false);
      assert.strictEqual(cfg.traffic.provider, 'simulation');
      assert.strictEqual(cfg.traffic.googleConfigured, false);
      assert.strictEqual(cfg.traffic.mapplsConfigured, false);
    });

    it('produces sanitized diagnostic object without leaking secrets', () => {
      const sensitivePassword = 'myUltraSecretPassword123';
      const sensitiveJwt = 'myUltraPrivateTokenSecret999';
      const cfg = createConfig({
        NODE_ENV: 'test',
        DATA_STORE_MODE: 'mongodb',
        MONGODB_URI: `mongodb://user:${sensitivePassword}@localhost:27017/testdb`,
        JWT_SECRET: sensitiveJwt,
      });

      const sanitized = cfg.getSanitized();
      const serialized = JSON.stringify(sanitized);

      assert.strictEqual(serialized.includes(sensitivePassword), false);
      assert.strictEqual(serialized.includes(sensitiveJwt), false);
      assert.strictEqual(sanitized.auth.secretConfigured, true);
      assert.ok(sanitized.database.maskedUri.includes('*****'));
    });
  });

  describe('4. Strict Fail-Fast Validation Rules', () => {
    it('throws error when invalid DATA_STORE_MODE is supplied', () => {
      assert.throws(() => {
        createConfig({ DATA_STORE_MODE: 'redis' });
      }, /Invalid DATA_STORE_MODE "redis"/);
    });

    it('throws error when DATA_STORE_MODE=mongodb but MONGODB_URI is missing', () => {
      assert.throws(() => {
        createConfig({ DATA_STORE_MODE: 'mongodb', MONGODB_URI: '' });
      }, /DATA_STORE_MODE=mongodb requires MONGODB_URI/);
    });

    it('throws error when invalid TRAFFIC_PROVIDER is supplied', () => {
      assert.throws(() => {
        createConfig({ TRAFFIC_PROVIDER: 'unsupported_provider' });
      }, /Invalid TRAFFIC_PROVIDER "unsupported_provider"/);
    });

    it('throws critical security error when in production with default JWT secret', () => {
      assert.throws(() => {
        createConfig({
          NODE_ENV: 'production',
          JWT_SECRET: 'uyirkappan-dev-secret-change-me',
        });
      }, /CRITICAL SECURITY ERROR: Production environment requires a strong custom JWT_SECRET/);
    });

    it('allows production startup when a strong custom JWT secret is provided', () => {
      const cfg = createConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'a_very_strong_and_secure_production_secret_key_12345!',
      });
      assert.strictEqual(cfg.dispatch.requireOnlineDriver, true);
    });

    it('rejects invalid online-driver dispatch policy values', () => {
      assert.throws(() => {
        createConfig({ DISPATCH_REQUIRE_ONLINE_DRIVER: 'sometimes' });
      }, /DISPATCH_REQUIRE_ONLINE_DRIVER must be "true" or "false"/);
    });
  });

  describe('5. Backwards Compatibility with Legacy environment.js', () => {
    it('exports all expected fields via environment.js matching config properties', () => {
      assert.ok('PORT' in environment);
      assert.ok('DATA_STORE_MODE' in environment);
      assert.ok('MONGODB_URI' in environment);
      assert.ok('TRAFFIC_PROVIDER' in environment);
      assert.ok('JWT_SECRET' in environment);
      assert.ok('DRIVER_RESPONSE_TIMEOUT_MS' in environment);
      assert.strictEqual(typeof environment.PORT, 'number');
    });
  });

  describe('6. REST Diagnostic Endpoint: GET /api/system/config', () => {
    it('returns 200 OK with sanitized configuration and zero raw secrets', async () => {
      const express = require('express');
      const buildApiRoutes = require('../src/app');
      const store = new MemoryStore();
      const app = express();
      app.use(express.json());
      app.use('/api', buildApiRoutes({ store }));

      const server = app.listen(0);
      const port = server.address().port;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/system/config`);
        assert.strictEqual(response.status, 200);

        const body = await response.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.config);
        assert.ok(body.config.server);
        assert.ok(body.config.database);
        assert.ok(body.config.traffic);
        assert.ok(body.config.auth);
        assert.ok(body.config.datasets);

        // Verify no raw JWT secrets are exposed in response
        const jsonStr = JSON.stringify(body);
        assert.strictEqual(jsonStr.includes('uyirkappan-dev-secret-change-me'), false);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });

});
