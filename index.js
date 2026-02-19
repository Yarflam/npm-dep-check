#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const NDC_SEP = '|';
const VERSION = '2.0.2';

/* Parse arguments */
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`npm-dep-check v${VERSION}

Find which packages depend on a specific module in your project.

Usage:
  npm-dep-check <project-path> <module-name>
  npm-dep-check --help | -h
  npm-dep-check --version | -v

Examples:
  npm-dep-check . lodash
  npm-dep-check /path/to/project express

Supports: package-lock.json (v1, v2, v3) and yarn.lock`);
    process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
    console.log(`npm-dep-check v${VERSION}`);
    process.exit(0);
}

/* Where the package.json and package-lock.json files are available */
const target = args[0];

/* The name of the package */
const name = args[1];

/* Check arguments */
if (!target || !name) {
    console.error('Usage: npm-dep-check <project-path> <module-name>');
    console.error('Run npm-dep-check --help for more information.');
    process.exit(1);
}

/**
 * Read JSON file safely
 */
function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`Error reading ${filePath}: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Parse package-lock.json v1 format (npm < 7)
 * Structure: { dependencies: { pkg: { version, requires } } }
 */
function parseLockfileV1(lockData) {
    const deps = lockData.dependencies || {};
    const ndps = [];

    for (const pkgName in deps) {
        const pkg = deps[pkgName];
        if (pkg.requires) {
            for (const [reqName, reqVersion] of Object.entries(pkg.requires)) {
                ndps.push([`${pkgName}${NDC_SEP}${reqName}`, reqVersion]);
            }
        }
        // Handle nested dependencies
        if (pkg.dependencies) {
            const nested = parseLockfileV1({ dependencies: pkg.dependencies });
            ndps.push(
                ...nested.map(([key, val]) => [`${pkgName}${NDC_SEP}${key}`, val])
            );
        }
    }

    return ndps;
}

/**
 * Parse package-lock.json v2/v3 format (npm 7+)
 * Structure: { packages: { "node_modules/pkg": { version, dependencies } } }
 */
function parseLockfileV2V3(lockData) {
    const packages = lockData.packages || {};
    const ndps = [];

    for (const pkgPath in packages) {
        // Skip root package
        if (!pkgPath) continue;

        const pkg = packages[pkgPath];
        const pkgName = pkgPath.replace(/^.*node_modules\//, '');

        if (pkg.dependencies) {
            for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
                ndps.push([`${pkgName}${NDC_SEP}${depName}`, depVersion]);
            }
        }
    }

    return ndps;
}

/**
 * Get all package versions from lockfile
 */
function getPackageVersions(lockData) {
    const versions = {};

    if (lockData.lockfileVersion >= 2) {
        // v2/v3 format
        const packages = lockData.packages || {};
        for (const pkgPath in packages) {
            if (!pkgPath) continue;
            const pkgName = pkgPath.replace(/^.*node_modules\//, '');
            versions[pkgName] = packages[pkgPath].version;
        }
    } else {
        // v1 format
        const deps = lockData.dependencies || {};
        for (const pkgName in deps) {
            versions[pkgName] = deps[pkgName].version;
        }
    }

    return versions;
}

/**
 * Parse yarn.lock
 */
function parseYarnLock(content) {
    const ndps = [];
    const versions = {};

    // Clean up yarn.lock content
    let cleaned = content
        .replace(/\x0A/g, '\n')
        .replace(/(^|\n)#[^\n]*/g, '$1')
        .replace(/\n+/g, '\n')
        .replace(/(^\n|\n$)/g, '');

    // Parse entries
    const entries = cleaned.split(/\n(?=\S)/);

    for (const entry of entries) {
        const lines = entry.split('\n');
        const header = lines[0];

        // Extract package name from header (e.g., "lodash@^4.17.0:")
        const nameMatch = header.match(/^"?(@?[^@\s"]+)/);
        if (!nameMatch) continue;

        const pkgName = nameMatch[1];
        let version = '';
        let deps = {};

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const versionMatch = line.match(/^\s+version\s+"?([^"\s]+)"?/);
            if (versionMatch) {
                version = versionMatch[1];
                versions[pkgName] = version;
            }

            if (line.match(/^\s+dependencies:/)) {
                // Parse dependencies block
                for (let j = i + 1; j < lines.length; j++) {
                    const depLine = lines[j];
                    if (!depLine.match(/^\s{4}/)) break;
                    const depMatch = depLine.match(/^\s+"?([^"\s]+)"?\s+"?([^"\s]+)"?/);
                    if (depMatch) {
                        deps[depMatch[1]] = depMatch[2];
                    }
                }
            }
        }

        for (const [depName, depVersion] of Object.entries(deps)) {
            ndps.push([`${pkgName}${NDC_SEP}${depName}`, depVersion]);
        }
    }

    return { ndps, versions };
}

/* Main logic */
(() => {
    const pckPath = path.resolve(target, 'package.json');
    const pckLockPath = path.resolve(target, 'package-lock.json');
    const yarnLockPath = path.resolve(target, 'yarn.lock');

    if (!fs.existsSync(pckPath)) {
        console.log('This is not an NPM project (package.json not found).');
        process.exit(1);
    }

    if (!fs.existsSync(pckLockPath) && !fs.existsSync(yarnLockPath)) {
        console.log('Please install node_modules first (package-lock.json or yarn.lock not found).');
        process.exit(1);
    }

    /* Read package.json */
    const pkg = readJson(pckPath);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const depsKeys = Object.keys(deps);

    if (depsKeys.includes(name)) {
        console.log(
            'The module is a direct dependency (found in package.json).\n'
        );
    }

    /* Read lockfile */
    let ndps = [];
    let versions = {};

    if (fs.existsSync(pckLockPath)) {
        const lockData = readJson(pckLockPath);
        const lockVersion = lockData.lockfileVersion || 1;
        console.log(`[package-lock.json v${lockVersion}]`);

        if (lockVersion >= 2) {
            ndps = parseLockfileV2V3(lockData);
        } else {
            ndps = parseLockfileV1(lockData);
        }
        versions = getPackageVersions(lockData);
    } else {
        console.log('[yarn.lock]');
        const yarnContent = fs.readFileSync(yarnLockPath, 'utf8');
        const parsed = parseYarnLock(yarnContent);
        ndps = parsed.ndps;
        versions = parsed.versions;
    }

    /* Deep indexing - expand transitive dependencies */
    let i = 0;
    while (i < ndps.length) {
        const [depChain] = ndps[i];
        const lastDep = depChain.split(NDC_SEP).pop();

        // Find dependencies of lastDep
        const subDeps = ndps.filter(([chain]) => {
            const parts = chain.split(NDC_SEP);
            return parts[0] === lastDep && parts.length === 2;
        });

        for (const [subChain] of subDeps) {
            const subDep = subChain.split(NDC_SEP)[1];
            const newChain = `${depChain}${NDC_SEP}${subDep}`;
            if (!ndps.some(([c]) => c === newChain)) {
                ndps.push([newChain, '']);
            }
        }
        i++;
    }

    /* Clean up - only keep chain keys */
    const ndpsKeys = ndps.map(([key]) => key);

    /* Search functions */
    const search = (moduleName) => {
        return ndpsKeys
            .map((k) => k.split(NDC_SEP))
            .filter((k) => k.includes(moduleName) && k.indexOf(moduleName) > 0)
            .map((k) => k[0]);
    };

    const searchRoot = (moduleName) => {
        const out = [];
        const stack = [moduleName];
        let i = 0;

        while (i < stack.length) {
            const parents = search(stack[i]);
            for (const m of parents) {
                if (depsKeys.includes(m)) {
                    if (!out.includes(m)) out.push(m);
                } else {
                    if (!stack.includes(m)) stack.push(m);
                }
            }
            i++;
        }

        stack.shift(); // Remove initial module
        return {
            main: out.sort(),
            depends: [...new Set(stack)].sort()
        };
    };

    /* Show results */
    console.log(
        `Analysis among ${ndpsKeys.length} dependency relations (${depsKeys.length} direct modules).`
    );

    const results = searchRoot(name);

    if (results.main.length) {
        console.log(
            `\nUsed by ${results.main.length} direct dependenc${results.main.length > 1 ? 'ies' : 'y'}:`
        );
        for (const m of results.main) {
            const ver = (deps[m] || '').replace(/^\^|~/, '');
            console.log(`  - ${m} [v${ver}]`);
        }
    }

    if (results.depends.length) {
        console.log(
            `\nUsed by ${results.depends.length} indirect dependenc${results.depends.length > 1 ? 'ies' : 'y'}:`
        );
        for (const m of results.depends) {
            const ver = versions[m] || '';
            console.log(`  - ${m} [v${ver}]`);
        }
    }

    /* Module info */
    const isDirectDep = depsKeys.includes(name);
    const isInstalled = name in versions;

    if (!results.main.length && !results.depends.length) {
        if (!isDirectDep && !isInstalled) {
            console.log(`\nModule "${name}" was not found in this project.`);
            process.exit(0);
        }

        // Module exists but nothing depends on it (it's a leaf or root dep)
        if (isDirectDep) {
            console.log(`\nNo other modules depend on "${name}" (it's a direct dependency).`);
        } else {
            console.log(`\nNo other modules depend on "${name}" in the dependency tree.`);
        }
    }

    const moduleVersion = deps[name]?.replace(/^\^|~/, '') || versions[name] || 'unknown';
    console.log(`\n✓ Module ${name} v${moduleVersion}`);
})();
