# Contributing to stellar-anchor-doctor

Thank you for your interest in contributing to `stellar-anchor-doctor`! This project is maintained under the **[Anchor Tools](https://github.com/anchor-tools)** organization and actively participates in the **Drips Wave** program.

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Setup
```bash
git clone https://github.com/anchor-tools/stellar-anchor-doctor.git
cd stellar-anchor-doctor
npm install
```

### Development Scripts
```bash
# Type check TypeScript
npm run typecheck

# Run unit tests
npm test

# Run tests with code coverage
npm run test:coverage

# Build library and binary
npm run build
```

---

## Drips Wave Contribution Guidelines

If you are contributing as part of a **Drips Wave sprint**, please follow these rules to ensure your Pull Request is reviewed quickly and awarded points:

1. **Claiming an Issue:**
   - Check the [Issues](https://github.com/anchor-tools/stellar-anchor-doctor/issues) tab for tasks labeled `Stellar Wave`.
   - Comment on the issue to express your interest before starting work.
   - Each Wave issue has a pre-defined complexity tier:
     - **Trivial (100 points):** Minor bug fixes, documentation, or small check additions.
     - **Medium (150 points):** Adding a new check rule, reporter format, or test harness.
     - **High (200 points):** New protocol suite (e.g. SEP-12/SEP-31), major architectural feature.

2. **Acceptance Criteria:**
   - Every Wave issue contains a `- [ ]` checklist of verifiable acceptance criteria.
   - Your PR must fulfill all acceptance criteria listed in the issue description.

3. **Writing Tests:**
   - Every new check or feature must include unit tests in `tests/`.
   - Never make live network calls in unit tests; use mock responses (see `tests/fixtures/mock-stellar-toml.ts`).
   - Run `npm test` and ensure all tests pass before submitting your PR.

4. **Pull Request Format:**
   - Link the relevant issue: `Fixes #<issue-number>`.
   - Describe what changed and why.
   - Include a snippet of terminal output demonstrating the new functionality.

---

## Code Style and Architecture

- **Modularity:** Each diagnostic suite lives in its own file under `src/checks/` (e.g., `sep1.ts`, `sep10.ts`).
- **Check Registration:** Register new checks in `src/checks/registry.ts`.
- **Diagnostic Findings:** Return structured findings (`DiagnosticFinding`) with `severity: 'pass' | 'info' | 'warn' | 'error'`.
- **Actionable Remediation:** Always provide a clear, beginner-friendly `remediation` string for any `warn` or `error` finding.

---

## Code of Conduct

All contributors must adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md).
