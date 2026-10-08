# stellar-anchor-doctor 🩺

[![CI](https://github.com/anchor-tools/stellar-anchor-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/anchor-tools/stellar-anchor-doctor/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Stellar Ecosystem](https://img.shields.io/badge/Stellar-SEPs%20Auditor-08b5e5.svg)](https://stellar.org)
[![Drips Wave](https://img.shields.io/badge/Drips%20Wave-project%20tasks-00c853.svg)](./DRIPS_WAVE.md)

Diagnostic scanner for live Stellar Anchor deployments. Checks anchor configuration, selected SEP endpoints, basic SEP-10 challenge structure, CORS policies, and HTTPS/HSTS across **SEP-1**, **SEP-10**, **SEP-24**, **SEP-38**, **SEP-6**, and **Transport Security**.

[**Read the documentation site**](https://anchor-tools.github.io/stellar-anchor-doctor/) · [Contributing](./CONTRIBUTING.md) · [Wave task backlog](./DRIPS_WAVE.md)

The documentation lives in [`docs/index.html`](./docs/index.html) and is published to GitHub Pages when changes reach `main`.

```console
$ npx stellar-anchor-doctor testanchor.stellar.org

🩺 Stellar Anchor Doctor — Audit Report for testanchor.stellar.org
Timestamp: 2026-10-08T05:30:00.000Z | Duration: 642ms

[SEP-0001]
  ✔ stellar.toml Discovered: Successfully loaded stellar.toml (1842 bytes in 120ms)
  ✔ CORS Header Valid: Access-Control-Allow-Origin is set to *
  ✔ Content-Type Valid: Content-Type is 'text/plain; charset=utf-8'
  ✔ Valid TOML Syntax: stellar.toml parsed successfully without syntax errors
  ✔ NETWORK_PASSPHRASE Valid: Matches Testnet passphrase exactly
  ✔ SIGNING_KEY Valid: Stellar Ed25519 public key passes CRC16 checksum verification
  ℹ Discovered AUTH_SERVER: SEP-10 Auth Server: https://testanchor.stellar.org/auth
  ℹ Discovered TRANSFER_SERVER_SEP0024: SEP-24 Server: https://testanchor.stellar.org/sep24
  ℹ Discovered ANCHOR_QUOTE_SERVER (SEP-38): SEP-38 Server: https://testanchor.stellar.org/sep38

[SEP-0010]
  ✔ AUTH_SERVER Responding: Successfully received response from /auth (210ms)
  ✔ AUTH_SERVER CORS Allowed: Access-Control-Allow-Origin is set to *
  ✔ Valid Challenge Transaction XDR: Parsed transaction envelope successfully
  ✔ Sequence Number Valid: Challenge transaction sequence number is 0
  ✔ Timebounds Valid: Timebounds window is 300s
  ✔ Manage Data Operation Present: Found 1 Manage Data operation(s) in challenge transaction
  ✔ Server Signature Present: Challenge transaction contains 1 server signature(s)

[SEP-0024]
  ✔ SEP-24 /info Endpoint Accessible: Successfully connected to /sep24/info (145ms)
  ✔ SEP-24 CORS Allowed: Access-Control-Allow-Origin is set to *
  ✔ Deposit Assets Configured: Found 1 deposit asset(s): USDC
  ✔ Withdrawal Assets Configured: Found 1 withdrawal asset(s): USDC

[SEP-0038]
  ✔ SEP-38 /info Endpoint Accessible: Successfully connected to /sep38/info (167ms)
  ✔ SEP-38 CORS Allowed: Access-Control-Allow-Origin is set to *
  ✔ Quote Assets Configured: Configured 1 asset(s) for RFQ quotes

[SECURITY]
  ✔ HTTPS Enforced: Domain testanchor.stellar.org serves traffic over encrypted HTTPS/TLS
  ✔ HSTS Header Active: Strict-Transport-Security is active
  ✔ All Declared Endpoints Use HTTPS: Every discovered anchor service endpoint uses encrypted HTTPS transport

────────────────────────────────────────────────────────────────
Overall Health Score: 100/100 [Grade: A+]
Summary: 18 passed, 0 errors, 0 warnings, 3 notices (21 total checks)
────────────────────────────────────────────────────────────────
```

---

## Why this exists

Building or integrating a Stellar Anchor involves coordinating multiple interconnected Stellar Ecosystem Proposals (SEPs). In practice, integrations frequently break due to:
- **Missing or non-wildcard CORS headers** on auth or transfer endpoints, preventing browser wallets (like Freighter or Albedo) from executing deposit/withdrawal flows.
- **Malformed SEP-10 Challenge Transactions** (e.g. sequence number not equal to `0`, expired or excessively long timebounds, missing Manage Data nonces).
- **Misconfigured `/info` schemas** in SEP-24, SEP-38, or SEP-6 that cause wallet apps to fail silent or abort transactions.
- **Insecure endpoint URLs** mixing HTTP and HTTPS.

While [`stellar-toml-lint`](https://github.com/anchor-tools/stellar-toml-lint) lints local `stellar.toml` files offline during CI, **`stellar-anchor-doctor`** checks selected endpoints in a live deployment. It is a diagnostic aid—not a complete SEP conformance suite or a security audit.

---

## Installation

### Via npm (Global)
```bash
npm install -g stellar-anchor-doctor
```

### Run directly with `npx`
```bash
npx stellar-anchor-doctor <domain>
```

---

## Usage

```bash
# Audit an anchor on Stellar Public Network
stellar-anchor-doctor anchor.example.com

# Audit an anchor on Stellar Testnet
stellar-anchor-doctor testanchor.stellar.org --testnet

# Output report as JSON (for CI/CD pipelines and dashboards)
stellar-anchor-doctor anchor.example.com --format json

# Output report as Markdown (for GitHub Issue/PR comments)
stellar-anchor-doctor anchor.example.com --format markdown

# Treat warnings as errors (fail with exit code 1)
stellar-anchor-doctor anchor.example.com --strict

# Skip specific check suites
stellar-anchor-doctor anchor.example.com --skip sep-38,sep-6

# Customize network request timeout (in milliseconds)
stellar-anchor-doctor anchor.example.com --timeout 12000

# List all available checks and specifications
stellar-anchor-doctor list-checks
```

### CLI Options

| Flag | Default | Description |
| :--- | :--- | :--- |
| `[domain]` | *required* | Apex domain or hostname of the anchor to audit |
| `-f, --format <fmt>` | `text` | Output reporter format: `text`, `json`, or `markdown` |
| `--strict` | `false` | Treat warnings as errors and exit with code `1` |
| `--skip <checks>` | `none` | Comma-separated check IDs to bypass (e.g. `sep-38,sep-6`) |
| `--timeout <ms>` | `8000` | Network request timeout in milliseconds |
| `--testnet` | `false` | Validate against Stellar Testnet network passphrase |
| `-q, --quiet` | `false` | For text output, show warnings, errors, and summary only |
| `--no-color` | `false` | Disable ANSI terminal colors |
| `-V, --version` | | Output version number |
| `-h, --help` | | Display help manual |

### Exit Codes

- **`0`**: All checks passed (or only warnings when `--strict` is not enabled).
- **`1`**: Diagnostic errors detected (or warnings present with `--strict`).
- **`2`**: Command-line usage error or invalid arguments.

---

## Supported Diagnostic Suites

| Check Suite | Description | Spec Reference |
| :--- | :--- | :--- |
| **`sep-1`** | Stellar Info File (`stellar.toml`) location, CORS wildcard, Content-Type, TOML syntax, network passphrase, Ed25519 public key CRC16 verification, and currency declarations | [SEP-0001](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md) |
| **`sep-10`** | `AUTH_SERVER` endpoint responsiveness, wildcard CORS, challenge XDR decoding, sequence number `0` check, timebounds grace period, manage data nonces, and server signature | [SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) |
| **`sep-24`** | `TRANSFER_SERVER_SEP0024` `/info` endpoint, CORS, deposit and withdrawal mapping presence, and fee configuration declaration | [SEP-0024](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md) |
| **`sep-38`** | `ANCHOR_QUOTE_SERVER` `/info` endpoint, CORS, assets array presence, and basic quote-asset identifier format counts | [SEP-0038](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md) |
| **`sep-6`** | `TRANSFER_SERVER` `/info` endpoint, CORS, and reporting of configured deposit/withdrawal mappings | [SEP-0006](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md) |
| **`security`** | HTTPS URL schemes for selected declared endpoints and HSTS (`Strict-Transport-Security`) header presence | [Security Best Practices](https://developers.stellar.org/docs/anchoring-assets/) |

These checks cover selected fields and response shapes, not every requirement in each SEP. In particular, SEP-10 currently checks for a Manage Data operation and at least one challenge signature but does **not** cryptographically verify the signer against `SIGNING_KEY` or validate every nonce and domain rule. A passing result is not a certification or guarantee of funds safety.

---

## Programmatic API

You can import `stellar-anchor-doctor` as a library in your Node.js or TypeScript projects:

```typescript
import { DoctorEngine } from 'stellar-anchor-doctor';

const engine = new DoctorEngine();
const report = await engine.runAudit({
  domain: 'anchor.example.com',
  testnet: false,
  timeout: 8000,
});

console.log(`Health Score: ${report.score}/100 (${report.grade})`);
for (const finding of report.findings) {
  if (finding.severity === 'error') {
    console.error(`[${finding.category}] ${finding.title}: ${finding.message}`);
    console.log(`  Remediation: ${finding.remediation}`);
  }
}
```

---

## Drips Wave

`stellar-anchor-doctor` is maintained by [Anchor Tools](https://github.com/anchor-tools). The repository includes proposed, scoped contributor tasks for Drips Wave:

- **Documentation site:** [Read the project guide](https://anchor-tools.github.io/stellar-anchor-doctor/).
- **Proposed tasks:** See [`DRIPS_WAVE.md`](./DRIPS_WAVE.md), then check live issues and current program rules before starting work.
- **Contribution guide:** See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

Licensed under the **Apache License, Version 2.0**. See [`LICENSE`](./LICENSE) for terms.
