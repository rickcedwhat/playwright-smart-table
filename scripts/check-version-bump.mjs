import { execSync } from 'child_process';
import fs from 'fs';

try {
    // 1. Get the list of staged files
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' }).split('\n');

    // 2. Check if package.json is staged
    if (!stagedFiles.includes('package.json')) {
        process.exit(0); // package.json not modified, nothing to do
    }

    // 3. Get generic package.json content helpers
    const getVersion = (ref) => {
        try {
            const content = execSync(`git show ${ref}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
            return JSON.parse(content).version;
        } catch (e) {
            return null; // File might be new or deleted
        }
    };

    // 4. Compare versions
    const currentVersion = getVersion(':package.json'); // Staged version
    const oldVersion = getVersion('HEAD:package.json'); // Last commit version

    if (currentVersion && oldVersion && currentVersion !== oldVersion) {
        console.log(`📦 Version bump detected: ${oldVersion} -> ${currentVersion}`);

        // 5. Check if CHANGELOG.md is staged
        const isChangelogStaged = stagedFiles.some(f => f.includes('CHANGELOG.md'));

        if (!isChangelogStaged) {
            console.error('\n❌ ERROR: package.json version bumped but CHANGELOG.md was not updated.');
            console.error('👉 Please update CHANGELOG.md to document your changes.\n');
            process.exit(1);
        }

        // 6. Verify the new version is actually in the changelog content
        try {
            const changelogContent = fs.readFileSync('CHANGELOG.md', 'utf8');
            if (!changelogContent.includes(`[${currentVersion}]`)) {
                console.error(`\n❌ ERROR: CHANGELOG.md is staged but missing entry for version [${currentVersion}].`);
                console.error(`👉 Please add a "## [${currentVersion}]" section to CHANGELOG.md.\n`);
                process.exit(1);
            }
        } catch (e) {
            console.warn('⚠️ Could not verify CHANGELOG.md content:', e.message);
        }

        console.log('✅ CHANGELOG.md update confirmed.');

        // 7. Verify pnpm-lock.yaml is staged
        //    pnpm version runs a full install, updating the lockfile alongside package.json.
        const isLockStaged = stagedFiles.includes('pnpm-lock.yaml');
        if (!isLockStaged) {
            console.error('\n❌ ERROR: package.json version was changed but pnpm-lock.yaml was not staged.');
            console.error('👉 Always use: pnpm version minor (or patch/major) — never edit package.json directly.');
            console.error('   pnpm version updates both files with full dependency resolution.\n');
            process.exit(1);
        }

        console.log('✅ pnpm-lock.yaml is staged.');
    }

} catch (error) {
    // If we can't run git commands (e.g. no git repo yet, or first commit), we skip check.
    process.exit(0);
}
