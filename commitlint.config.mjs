export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // CodeRabbit (and similar bots) often write a single long body sentence.
    // Keep subject/type rules; don't fail CI on body wrapping.
    'body-max-line-length': [0],
  },
  // Ignore Dependabot commits as they often violate other body conventions with long URLs
  ignores: [(message) => message.includes('Signed-off-by: dependabot[bot]')],
};
