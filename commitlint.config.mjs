export default {
  extends: ['@commitlint/config-conventional'],
  // Ignore Dependabot commits as they often violate body line length with long URLs
  ignores: [(message) => message.includes('Signed-off-by: dependabot[bot]')],
};
