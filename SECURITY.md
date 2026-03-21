# Security Policy

## Supported Versions

Only the latest version of `playwright-smart-table` receives security updates.

| Version | Supported |
|---------|-----------|
| Latest  | ✅ |
| < Latest | ❌ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

To report a vulnerability, open a [GitHub Security Advisory](https://github.com/rickcedwhat/playwright-smart-table/security/advisories/new) (private, only visible to maintainers).

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

You can expect an acknowledgement within **3 business days** and a resolution or status update within **14 days**.

## Scope

This is a **Playwright test utility library**. It runs exclusively in test environments and does not handle authentication, user data, or network requests in production contexts. The attack surface is limited to:

- Malicious table structures in test environments
- Dependency vulnerabilities (`@playwright/test`)

For dependency vulnerabilities, please check [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) first and open a standard issue if it's a transitive dependency concern.
