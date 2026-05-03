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

        // 7. Verify package-lock.json is staged at all
        const isLockStaged = stagedFiles.includes('package-lock.json');
        if (!isLockStaged) {
            console.error('\n❌ ERROR: package.json version was changed but package-lock.json was not staged.');
            console.error('👉 Always use: npm version minor (or patch/major) — never edit package.json directly.');
            console.error('   npm version updates both files with full dependency resolution.\n');
            process.exit(1);
        }

        // 8. Verify package-lock.json version matches
        try {
            const lockRaw = fs.readFileSync('package-lock.json', 'utf8');
            const lockVersion = JSON.parse(lockRaw).version;
            if (lockVersion !== currentVersion) {
                console.error(`\n❌ ERROR: package-lock.json version (${lockVersion}) does not match package.json (${currentVersion}).`);
                console.error('👉 Always use: npm version minor (or patch/major) — never edit package.json directly.');
                console.error('   npm version updates both files with full dependency resolution.\n');
                process.exit(1);
            }
        } catch (e) {
            console.warn('⚠️ Could not verify package-lock.json version:', e.message);
        }

        // 9. Detect shallow lockfile update (direct edit or --package-lock-only).
        //    npm version runs a full install, which changes integrity hashes and resolved URLs
        //    throughout the lockfile — not just the top-level version strings.
        //    Strip version fields from both snapshots; if they're identical the lockfile
        //    was not fully regenerated.
        try {
            const stripVersions = (raw) => {
                const obj = JSON.parse(raw);
                delete obj.version;
                if (obj.packages?.['']) delete obj.packages[''].version;
                return JSON.stringify(obj);
            };

            const stagedLockRaw = execSync('git show :package-lock.json', { encoding: 'utf8' });
            const headLockRaw = execSync('git show HEAD:package-lock.json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });

            const stagedNorm = stripVersions(stagedLockRaw);
            const headNorm   = stripVersions(headLockRaw);

            if (stagedNorm === headNorm) {
                console.error('\n❌ ERROR: package-lock.json only has its version field changed — dependency tree was not resolved.');
                console.error('   This happens with --package-lock-only or a direct package.json edit.');
                console.error('👉 Always use: npm version minor (or patch/major)');
                console.error('   It runs a full npm install so the lockfile is properly regenerated.\n');
                process.exit(1);
            }
        } catch (e) {
            console.warn('⚠️ Could not verify lockfile depth:', e.message);
        }

        console.log('✅ package-lock.json is in sync.');
    }

} catch (error) {
    // If we can't run git commands (e.g. no git repo yet, or first commit), we skip check.
    process.exit(0);
}
