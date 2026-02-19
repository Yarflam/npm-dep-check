# npm-dep-check

Find which packages depend on a specific module in your project.

## Install

This script is intended to work as a global package:

```bash
npm i -g npm-dep-check
```

The module doesn't use any external dependencies.

## Usage

```bash
npm-dep-check <project-path> <module-name>
```

**Options:**

- `--help`, `-h` — Show help
- `--version`, `-v` — Show version

**Example:**

```bash
npm-dep-check . lodash
```

Output:

```
The module is a direct dependency (found in package.json).

[package-lock.json v3]
Analysis among 1297 dependency relations (2 direct modules).

✓ Module lodash v4.17.23
```

**Finding indirect dependencies:**

```bash
npm-dep-check . debug
```

Output:

```
[package-lock.json v3]
Analysis among 1297 dependency relations (2 direct modules).

Used by 1 direct dependency:
  - express [v5.2.1]

Used by 5 indirect dependencies:
  - body-parser [v2.2.2]
  - finalhandler [v2.1.1]
  - router [v2.2.0]
  - send [v1.2.1]
  - serve-static [v2.2.1]

✓ Module debug v4.4.3
```

## Supported Lockfiles

- `package-lock.json` v1, v2, v3 (npm 6, 7, 8+)
- `yarn.lock` (Yarn classic)

## Versions

- **v2.0.0**: Support for package-lock.json v2/v3, improved CLI with --help/--version, better error handling
- **v1.0.1**: Yarn support
- **v1.0.0**: First version

## Author

- Yarflam — _initial work_

## License

ISC — Free / Open Source / Peace & Love <3
