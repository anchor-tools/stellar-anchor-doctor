# Drips Wave Contributor Guide & Proposed Backlog

This is a maintainer's set of **proposed** contributor tasks for `stellar-anchor-doctor`. It is not an official Drips Wave listing, does not guarantee eligibility or rewards, and is not a substitute for the live program rules. Before publishing a task, confirm its scope, labels, acceptance criteria, and current program requirements with the maintainers.

## Wave Program Alignment

The project is a modular Stellar developer tool with mock-based tests and a backlog of bounded improvements:
- **Ecosystem Relevance:** Directly serves Stellar Anchors, wallet developers, and nodes by verifying compliance with Stellar Ecosystem Proposals (SEPs).
- **High Modular Extensibility:** New checks, reporters, and protocol audits can be added as isolated modules without breaking core engine logic.
- **Clear Acceptance Criteria:** The proposed tasks include testable outcomes; review each proposal against the current code before opening an issue.

---

## Proposed Contributor Tasks

These drafts are starting points for maintainers. Publish tasks as individual GitHub issues only after confirming the scope, effort, labels, and acceptance criteria.

---

### Issue 1: Add SEP-12 KYC `/customer` Endpoint Diagnostic Check
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Small
- **Context:** Stellar anchors use SEP-12 for customer KYC data verification. If `KYC_SERVER` is declared in `stellar.toml`, anchors should serve a responsive `GET /customer` endpoint with proper CORS headers.
- **Scope:**
  - In-scope: Check for `KYC_SERVER` in `context.endpoints`, ping `GET <KYC_SERVER>/customer` with dummy query parameters, verify CORS `Access-Control-Allow-Origin: *`, and verify expected status (200 or 400).
  - Out of scope: Do not perform `PUT /customer` or handle binary document uploads.
- **Acceptance Criteria:**
  - [ ] Implement `src/checks/sep12.ts` adhering to `DiagnosticCheck` interface.
  - [ ] Register check in `src/checks/registry.ts`.
  - [ ] Add unit test in `tests/sep12.test.ts` with mock HTTP responses.
  - [ ] Provide remediation message advising maintainers on configuring CORS for KYC servers.

---

### Issue 2: Add SARIF Output Reporter (`--format sarif`) for GitHub Code Scanning
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Medium
- **Context:** Teams deploying Stellar Anchors want to run `stellar-anchor-doctor` inside GitHub Actions CI/CD and have findings displayed directly in GitHub's "Security > Code Scanning" tab using SARIF 2.1.0 format.
- **Scope:**
  - In-scope: Create `src/reporters/sarif.ts` converting `AnchorReport` into a valid OASIS SARIF v2.1.0 JSON object.
  - Out of scope: Do not upload SARIF directly; only format output to stdout.
- **Acceptance Criteria:**
  - [ ] Create `src/reporters/sarif.ts` producing valid SARIF 2.1.0 JSON.
  - [ ] Add `--format sarif` CLI option support in `src/cli.ts`.
  - [ ] Map error severity to SARIF `'error'`, warn to `'warning'`, info to `'note'`.
  - [ ] Add unit tests in `tests/reporters.test.ts` validating SARIF schema output.

---

### Issue 3: Add JUnit XML Reporter (`--format junit`) for CI Test Pipelines
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Small
- **Context:** Automated build systems (CircleCI, GitLab CI, Jenkins) ingest JUnit XML test results to visualize test failures and flaky endpoints.
- **Scope:**
  - In-scope: Implement `src/reporters/junit.ts` generating standard JUnit XML from audit findings.
- **Acceptance Criteria:**
  - [ ] Implement `src/reporters/junit.ts`.
  - [ ] Support `--format junit` in `src/cli.ts`.
  - [ ] Output valid XML `<testsuites>` with `<testcase>` and `<failure>` tags for error findings.
  - [ ] Add unit test verifying XML structure in `tests/reporters.test.ts`.

---

### Issue 4: Add SEP-31 Cross-Border Remittances Endpoint Audit
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Medium
- **Context:** Anchors facilitating direct cross-border payments declare `DIRECT_PAYMENT_SERVER` (SEP-31). The endpoint must provide an accessible `/info` endpoint with supported receiving and sending asset schemas.
- **Scope:**
  - In-scope: Discover `DIRECT_PAYMENT_SERVER` from SEP-1 metadata, request its `/info` endpoint, and validate the documented SEP-31 response fields and CORS behavior.
- **Acceptance Criteria:**
  - [ ] Implement `src/checks/sep31.ts`.
  - [ ] Discover and retain the `DIRECT_PAYMENT_SERVER` URL from `stellar.toml`.
  - [ ] Register `sep-31` check in `src/checks/registry.ts`.
  - [ ] Add SEP-1 discovery tests and mock-based endpoint tests in `tests/sep31.test.ts`.
  - [ ] Update `README.md` list of supported checks.

---

### Issue 5: Add Retry Logic and Backoff for Transient Network Failures
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Medium
- **Context:** When running audits against remote anchors, transient network blips or cold-start lambdas can cause spurious timeout failures.
- **Scope:**
  - In-scope: Add `--retries <count>` CLI option (default: 1) and retry logic with exponential backoff in `src/utils/http.ts`.
- **Acceptance Criteria:**
  - [ ] Support `--retries <n>` option in `src/cli.ts` and `DoctorOptions`.
  - [ ] Implement retry loop in `safeFetch` for 5xx responses and connection resets.
  - [ ] Add unit test verifying that retry succeeds when initial request fails.

---

### Issue 6: Add Single-Page HTML Report Generator (`--format html`)
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Medium
- **Context:** Anchor operators want to share audit results with non-technical stakeholders or save standalone visual compliance reports.
- **Scope:**
  - In-scope: Implement `src/reporters/html.ts` generating a self-contained, responsive HTML report with CSS and SVG score gauges.
  - Out of scope: No external CDN or JavaScript runtime dependencies; single standalone HTML string.
- **Acceptance Criteria:**
  - [ ] Create `src/reporters/html.ts`.
  - [ ] Support `--format html` in `src/cli.ts`.
  - [ ] Embed clean CSS styling with visual pass/warn/error badges.
  - [ ] Add unit test verifying valid HTML markup output.

---

### Issue 7: Add SEP-10 Client Domain Verification Audit
- **Labels:** `Stellar Wave`, `enhancement`
- **Suggested effort:** Large
- **Context:** Newer revisions of SEP-10 allow wallets to provide a `client_domain` parameter. The auth server must include a `client_domain` Manage Data operation and verify the client domain signature.
- **Scope:**
  - In-scope: Audit how `AUTH_SERVER` handles challenge requests containing `&client_domain=example.com`. Verify that returned challenge transaction includes corresponding `client_domain` Manage Data operation.
- **Acceptance Criteria:**
  - [ ] Extend `src/checks/sep10.ts` to test client domain challenge generation.
  - [ ] Validate presence of `client_domain` manageData op when requested.
  - [ ] Add unit tests in `tests/sep10.test.ts` verifying client domain handling.
  - [ ] Add unit tests for valid, invalid, and absent client-domain challenge cases.
  - [ ] Document validation limits and any behavior that requires a client-domain signing key.
