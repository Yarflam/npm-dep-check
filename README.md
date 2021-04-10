# npm-dep-check

Find the dependencies of an NPM package.

## Install

This script is intended to work as a global package:

```bash
npm i -g npm-dep-check
```

The module doesn't use any dependencies to work.

## Usage

You should use it as follows:

```bash
npm-dep-check /path/of/your-node-project name-of-package
```

Note: the project must have the files `package.json` and `package-lock.json` (or `yarn.lock`).

**Example**

```bash
npm-dep-check . netmask
```

Output:

```text
[package-lock.json]
Analysis among 3762 dependencies (184 modules).
Used by 1 direct dependency:
- node-mailjet [v3.3.1]
Used by 4 indirect dependencies:
- pac-proxy-agent [v2.0.2]
- pac-resolver [v3.0.0]
- proxy-agent [v2.3.1]
- superagent-proxy [v1.0.3]

Module netmask v1.0.6
```

## Versions

-   **v1.0.1**: Yarn Support
-   **v1.0.0**: First version

## Author

-   Yarflam - _initial worker_

## Licence

Free / Open Source / Peace & Love <3
