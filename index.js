#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const NDC_SEP = '|';

/* Where the package.json and package-lock.json files are available */
const target = process.argv.slice(-2, -1)[0];

/* The name of the package */
const name = process.argv.slice(-1)[0];

/* Check it */
(() => {
    if (target && name) {
        const pckPath = path.resolve(target, 'package.json');
        const pckLockPath = path.resolve(target, 'package-lock.json');
        const yarnLockPath = path.resolve(target, 'yarn.lock');
        if (
            fs.existsSync(pckPath) &&
            (fs.existsSync(pckLockPath) || fs.existsSync(yarnLockPath))
        ) {
            /* Read package.json */
            const deps = require(pckPath).dependencies || {};
            const depsKeys = Object.keys(deps);
            if (depsKeys.indexOf(name) >= 0) {
                console.log(
                    'The module has been installed for the project (found in the package.json file).\n'
                );
            }

            /* Read package-lock.json or yarn.lock */
            let rdps;
            if (fs.existsSync(pckLockPath)) {
                console.log('[package-lock.json]');
                /* Import package-lock.json */
                rdps = require(pckLockPath).dependencies || {};
            } else {
                console.log('[yarn.lock]');
                /* Import yarn.lock (Yaml format) */
                rdps = fs.readFileSync(yarnLockPath, 'utf8');
                /* Clean up */
                rdps = rdps
                    .replace(/\x0A/g, '\n')
                    .replace(/(^|\n)#[^\n]*/g, '$1')
                    .replace(/\n+/g, '\n')
                    .replace(/(^\n|\n$)/g, '')
                    .replace(/\n {2}(?!dependencies|[^a-z])[^\n]+/g, '')
                    .replace(/(^|\n)"?([^",:\n ]+)"?[^\n]+/g, '$1$2');
                /* Convert to JSON format */
                rdps = JSON.parse(
                    `{${rdps
                        .replace(
                            /(^|\n)(@?[^@ ]+)@([^\n]+)/g,
                            '$1"$2":{"version":"$3",'
                        )
                        .replace(/\n {2}dependencies:/g, '"requires":{')
                        .replace(
                            /\n {4}"?([^" ]+)"? "?([^"\n]+)"?/g,
                            '"$1":"$2",'
                        )
                        .replace(/("requires":\{[^\n]+),(\n|$)/g, '$1},$2')
                        .replace(/,(\n|$)/g, '},')
                        .replace(/,$/, '')}}`
                );
            }
            /* Indexing */
            let ndps = [];
            for (let rdpsName in rdps) {
                if (typeof rdps[rdpsName].requires !== 'undefined') {
                    ndps = ndps.concat(
                        Object.entries(
                            rdps[rdpsName].requires
                        ).map(([key, value]) => [
                            `${rdpsName}${NDC_SEP}${key}`,
                            value
                        ])
                    );
                }
            }

            /* Deep indexing */
            let i = 0;
            while (i < ndps.length) {
                if (typeof ndps[i][1].requires !== 'undefined') {
                    ndps = ndps.concat(
                        Object.entries(
                            ndps[i][1].requires
                        ).map(([key, value]) => [
                            `${ndps[i][0]}${NDC_SEP}${key}`,
                            value
                        ])
                    );
                }
                i++;
            }
            /* Clean up */
            ndps = ndps.map(([key]) => key);

            /* Search in the tree path */
            const search = moduleName => {
                return ndps
                    .map(k => k.split(NDC_SEP))
                    .filter(k => k.indexOf(moduleName) > 0)
                    .map(k => k[0]);
            };
            const searchRoot = moduleName => {
                let i = 0,
                    out = [],
                    stack = [moduleName];
                while (i < stack.length) {
                    search(stack[i]).forEach(m => {
                        if (depsKeys.indexOf(m) >= 0) {
                            if (out.indexOf(m) < 0) out.push(m);
                        } else {
                            if (stack.indexOf(m) < 0) stack.push(m);
                        }
                    });
                    i++;
                }
                stack.splice(0, 1);
                return {
                    main: out.sort((a, b) => (a < b ? -1 : 1)),
                    depends: stack.reverse().sort((a, b) => (a < b ? -1 : 1))
                };
            };

            /* Show the results */
            console.log(
                `Analysis among ${ndps.length} dependencies (${depsKeys.length} modules).`
            );
            const results = searchRoot(name);
            if (results.main.length) {
                console.log(
                    `Used by ${results.main.length} direct dependenc${
                        results.main.length > 1 ? 'ies' : 'y'
                    }:`
                );
                results.main.forEach(m => {
                    console.log(
                        `- ${m} [v${(deps[m] || '').replace('^', '')}]`
                    );
                });
            }
            if (results.depends.length) {
                console.log(
                    `Used by ${results.depends.length} indirect dependenc${
                        results.depends.length > 1 ? 'ies' : 'y'
                    }:`
                );
                results.depends.forEach(m => {
                    console.log(
                        `- ${m} [v${(rdps[m].version || '').replace('^', '')}]`
                    );
                });
            }

            /* Not found */
            if (
                !results.main.length &&
                !results.depends.length &&
                depsKeys.indexOf(name) < 0
            ) {
                console.log(`Module ${name} was not found.`);
            } else {
                console.log(
                    `\nModule ${name} v${(
                        deps[name] ||
                        rdps[name].version ||
                        ''
                    ).replace('^', '')}`
                );
            }
        } else {
            if (!fs.existsSync(pckPath)) {
                console.log('This is not an NPM project.');
            } else {
                console.log('Please install the node_modules.');
            }
        }
    }
})();
