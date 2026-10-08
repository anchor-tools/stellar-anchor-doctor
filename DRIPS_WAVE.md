# Drips Wave Contributor Guide

This repository has seven open issues proposed for Drips Wave. They are project-maintained tasks, not confirmation that the repository or issues have been accepted into a Wave. Check the [current Drips Wave rules](https://docs.drips.network/wave/) and follow the organizers' application and issue-tagging process.

## Open tasks

| Issue | Task | Complexity |
| --- | --- | --- |
| [#1](https://github.com/anchor-tools/stellar-anchor-doctor/issues/1) | Add SEP-12 KYC `/customer` endpoint diagnostic | Medium — 150 points |
| [#2](https://github.com/anchor-tools/stellar-anchor-doctor/issues/2) | Add SARIF output for GitHub code scanning | Medium — 150 points |
| [#3](https://github.com/anchor-tools/stellar-anchor-doctor/issues/3) | Add JUnit XML output for CI test pipelines | Medium — 150 points |
| [#4](https://github.com/anchor-tools/stellar-anchor-doctor/issues/4) | Add SEP-31 cross-border payments endpoint audit | Medium — 150 points |
| [#5](https://github.com/anchor-tools/stellar-anchor-doctor/issues/5) | Retry transient network failures with exponential backoff | Medium — 150 points |
| [#6](https://github.com/anchor-tools/stellar-anchor-doctor/issues/6) | Add standalone HTML audit report output | Medium — 150 points |
| [#7](https://github.com/anchor-tools/stellar-anchor-doctor/issues/7) | Audit SEP-10 client domain challenge handling | Medium — 150 points |

The estimates follow the [Drips complexity guidance](https://www.drips.network/blog/posts/creating-meaningful-issues): Trivial is 100 points, Medium is 150 points, and High is 200 points. The labels on each live issue identify its current estimate; the Wave organizers' rules take precedence.

## Contributing

- Read the full problem, scope, implementation guidance, and acceptance checklist in the live issue before starting.
- Check the issue is still open and follow any assignment or coordination instructions there.
- Install Node.js 20.19 or newer, then run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
- Use mocked HTTP responses in tests; do not make live network calls from unit tests.
- Open a pull request that links the issue and explains the change, tests, and any relevant CLI output.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the project setup and contribution conventions.
