#!/usr/bin/env node
/**
 * Basic tests for npm-dep-check
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLI = path.join(__dirname, 'index.js');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (err) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${err.message}`);
        failed++;
    }
}

function run(args, expectExit = 0) {
    try {
        const output = execSync(`node "${CLI}" ${args}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        if (expectExit !== 0) {
            throw new Error(`Expected exit code ${expectExit}, got 0`);
        }
        return output;
    } catch (err) {
        if (err.status !== undefined && err.status !== expectExit) {
            throw new Error(`Expected exit code ${expectExit}, got ${err.status}`);
        }
        return err.stdout || err.stderr || '';
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

// Create a test project
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-dep-check-test-'));
const pkgJson = {
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
        'lodash': '^4.17.0'
    }
};
const lockJson = {
    name: 'test-project',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
        '': { name: 'test-project', version: '1.0.0', dependencies: { lodash: '^4.17.0' } },
        'node_modules/lodash': { version: '4.17.21' }
    }
};

fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
fs.writeFileSync(path.join(testDir, 'package-lock.json'), JSON.stringify(lockJson, null, 2));

console.log('npm-dep-check tests\n');

test('--help shows usage', () => {
    const out = run('--help');
    assert(out.includes('npm-dep-check'), 'Should show name');
    assert(out.includes('Usage:'), 'Should show usage');
});

test('--version shows version', () => {
    const out = run('--version');
    assert(out.includes('npm-dep-check v'), 'Should show version');
});

test('no args shows error', () => {
    const out = run('', 1);
    assert(out.includes('Usage:'), 'Should show usage hint');
});

test('finds direct dependency', () => {
    const out = run(`"${testDir}" lodash`);
    assert(out.includes('direct dependency'), 'Should identify as direct');
    assert(out.includes('lodash'), 'Should mention lodash');
});

test('handles non-existent module', () => {
    const out = run(`"${testDir}" nonexistent-xyz`);
    assert(out.includes('not found'), 'Should say not found');
});

test('detects lockfile version', () => {
    const out = run(`"${testDir}" lodash`);
    assert(out.includes('package-lock.json v3'), 'Should detect v3');
});

// Cleanup
fs.rmSync(testDir, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
