# Installation validation

`npm run test:installation` validates the packed artifact without publishing it. The harness checks local and global installs in isolated temporary prefixes, npx-style execution, CLI help, a sample scan, JSON output, package contents, executable exposure, and global uninstall behavior.

The report includes the host platform, architecture, and Node runtime so failures can be compared across Windows, macOS, and Linux CI runners. It never creates a tag, release, registry publication, or credential.

```bash
npm run test:installation
```
