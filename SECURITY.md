# Security Policy

## Supported Versions

Only the latest minor release of the current major version receives security fixes.

| Version | Supported |
|---------|-----------|
| 6.x (latest) | ✅ |
| < 6.x | ❌ |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private [Report a Vulnerability](https://github.com/rickcedwhat/playwright-smart-table/security/advisories/new) feature instead. This keeps the report confidential until a fix is available.

If you're unable to use that, email **cedrick@qawolf.com** with "SECURITY" in the subject line.

### What to include

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a minimal proof-of-concept
- The version of `playwright-smart-table` affected
- Any suggested mitigations, if you have them

## Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgement | Within 5 business days |
| Severity assessment | Within 10 business days |
| Patch (critical/high) | Within 30 days |
| Patch (medium/low) | Best effort, typically next minor release |

## Scope

`playwright-smart-table` is a test-automation helper library. It runs entirely within Playwright test processes and has no server component, no network listeners, and no persistent data storage. The practical attack surface is narrow, but the following are in scope:

- Dependency vulnerabilities that expose downstream CI pipelines to code execution
- Any code path that could cause unintended file-system writes or reads during test runs
- Supply-chain issues (malicious package, typosquatting, compromised publish token)

The following are **out of scope**:

- Theoretical vulnerabilities with no practical exploit path in a test-automation context
- Issues in Playwright itself — report those at https://github.com/microsoft/playwright/security

## Disclosure Policy

Once a fix is published, a GitHub Security Advisory will be opened and a CVE requested if warranted. Credit will be given to the reporter unless they prefer to remain anonymous.
