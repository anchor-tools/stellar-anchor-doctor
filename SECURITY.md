# Security Policy

## Scope

`stellar-anchor-doctor` makes network requests to the anchor domain and service URLs supplied by
its input. Security reports are in scope when they could cause requests to reach unintended
systems, expose data from the machine running the tool, or make a check silently miss a meaningful
configuration problem.

The tool is a diagnostic aid, not a penetration-testing tool, complete SEP conformance suite, or
security certification. Do not include production credentials, secret keys, or personal data in
reports or reproduction steps.

## Reporting a Vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/anchor-tools/stellar-anchor-doctor/security/advisories/new).
Include the affected version, Node.js version, reproduction steps, and any relevant sanitized input.
Please do not publish vulnerability details in a public issue before a fix is available.

## Supported Versions

Security fixes are made for the latest version on the `main` branch. Upgrade to the latest version
before reporting an issue.
