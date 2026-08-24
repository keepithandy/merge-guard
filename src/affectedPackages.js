function decodeGitPath(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;

  return trimmed.slice(1, -1).replace(/\\([0-7]{1,3}|.)/g, (_, escape) => {
    if (/^[0-7]{1,3}$/.test(escape)) {
      return String.fromCharCode(Number.parseInt(escape, 8));
    }

    const escapes = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
      '\\': '\\',
      '"': '"'
    };
    return escapes[escape] ?? escape;
  });
}

function gitTokens(value) {
  return value.match(/"(?:\\.|[^"])*"|\S+/g)?.map(decodeGitPath) || [];
}

function normalizeRepositoryPath(value, stripSidePrefix = false) {
  if (typeof value !== 'string') return null;

  let normalized = value.trim();
  if (!normalized || normalized === '/dev/null') return null;
  if (stripSidePrefix && /^(?:a|b)\//.test(normalized)) normalized = normalized.slice(2);

  normalized = normalized.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.includes('\0')
    || normalized.split('/').some((part) => part === '..')
  ) {
    return null;
  }

  return normalized;
}

function pathFromMarker(value) {
  const token = value.trim().startsWith('"')
    ? gitTokens(value)[0]
    : value.split('\t', 1)[0].trim();
  return normalizeRepositoryPath(token, true);
}

function changeStatus(current, previousPath, currentPath) {
  if (current.deleted || !currentPath) return 'deleted';
  if (current.added || !previousPath) return 'added';
  if (current.renameFrom || current.renameTo || previousPath !== currentPath) return 'renamed';
  return 'modified';
}

function finalizeChange(current) {
  if (!current) return null;

  const previousPath = current.renameFrom ?? current.previousPath;
  const currentPath = current.renameTo ?? current.currentPath;
  const status = changeStatus(current, previousPath, currentPath);
  const path = status === 'deleted' ? previousPath : currentPath;

  if (!path) return null;

  return {
    path,
    previousPath: status === 'renamed' ? previousPath : null,
    status
  };
}

function changeKey(change) {
  return [change.status, change.previousPath || '', change.path].join('\0');
}

export function parseDiffFileChanges(diffText) {
  if (typeof diffText !== 'string' || !diffText.trim()) return [];

  const changes = [];
  let current = null;

  const flush = () => {
    const change = finalizeChange(current);
    if (change) changes.push(change);
  };

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      flush();
      const tokens = gitTokens(line.slice('diff --git '.length));
      current = {
        previousPath: normalizeRepositoryPath(tokens[0], true),
        currentPath: normalizeRepositoryPath(tokens[1], true),
        renameFrom: null,
        renameTo: null,
        added: false,
        deleted: false
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('rename from ')) {
      current.renameFrom = normalizeRepositoryPath(decodeGitPath(line.slice('rename from '.length)));
    } else if (line.startsWith('rename to ')) {
      current.renameTo = normalizeRepositoryPath(decodeGitPath(line.slice('rename to '.length)));
    } else if (line.startsWith('new file mode ')) {
      current.added = true;
    } else if (line.startsWith('deleted file mode ')) {
      current.deleted = true;
    } else if (line.startsWith('--- ')) {
      current.previousPath = pathFromMarker(line.slice(4));
    } else if (line.startsWith('+++ ')) {
      current.currentPath = pathFromMarker(line.slice(4));
    }
  }

  flush();

  const unique = new Map();
  for (const change of changes) unique.set(changeKey(change), change);

  return [...unique.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
    || (left.previousPath || '').localeCompare(right.previousPath || '')
    || left.status.localeCompare(right.status)
  );
}

function normalizePackageRecord(record) {
  if (!record || typeof record.root !== 'string') return null;
  const root = record.root === '.'
    ? '.'
    : normalizeRepositoryPath(record.root);
  if (!root) return null;

  return {
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : null,
    root
  };
}

function detectedPackages(workspaceModel) {
  const packages = Array.isArray(workspaceModel?.packages)
    ? workspaceModel.packages.map(normalizePackageRecord).filter(Boolean)
    : [];

  if (!packages.length) {
    const rootPackage = normalizePackageRecord(workspaceModel?.rootPackage);
    if (rootPackage) packages.push(rootPackage);
  }

  const unique = new Map();
  for (const packageRecord of packages) unique.set(packageRecord.root, packageRecord);

  return [...unique.values()].sort((left, right) => left.root.localeCompare(right.root));
}

function owningPackage(filePath, packages) {
  return packages
    .filter((packageRecord) =>
      packageRecord.root === '.'
      || filePath === packageRecord.root
      || filePath.startsWith(packageRecord.root + '/')
    )
    .sort((left, right) =>
      right.root.length - left.root.length || left.root.localeCompare(right.root)
    )[0] || null;
}

function changeEndpoints(change) {
  if (change.status === 'renamed' && change.previousPath && change.previousPath !== change.path) {
    return [
      { path: change.previousPath, status: change.status, role: 'previous' },
      { path: change.path, status: change.status, role: 'current' }
    ];
  }

  return [{
    path: change.path,
    status: change.status,
    role: change.status === 'deleted' ? 'previous' : 'current'
  }];
}

function sortFileRecords(records) {
  return records.sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.role.localeCompare(right.role)
    || left.status.localeCompare(right.status)
  );
}

export function mapChangedFilesToPackages(diffText, workspaceModel) {
  const changedFiles = parseDiffFileChanges(diffText);
  const packages = detectedPackages(workspaceModel);
  const directByRoot = new Map();
  const sharedFiles = [];

  for (const change of changedFiles) {
    for (const endpoint of changeEndpoints(change)) {
      const owner = owningPackage(endpoint.path, packages);
      if (!owner) {
        sharedFiles.push(endpoint);
        continue;
      }

      if (!directByRoot.has(owner.root)) {
        directByRoot.set(owner.root, {
          name: owner.name,
          root: owner.root,
          reason: 'changed path is inside the detected package root',
          files: []
        });
      }
      directByRoot.get(owner.root).files.push(endpoint);
    }
  }

  const directPackages = [...directByRoot.values()]
    .map((packageRecord) => ({
      ...packageRecord,
      files: sortFileRecords(packageRecord.files)
    }))
    .sort((left, right) => left.root.localeCompare(right.root));

  sortFileRecords(sharedFiles);

  const sharedImpactPackages = sharedFiles.length
    ? packages.map((packageRecord) => ({
        ...packageRecord,
        reason: 'repository-level files may affect this package; this is a potential shared impact and does not infer dependencies',
        files: sharedFiles.map((file) => ({ ...file }))
      }))
    : [];

  return {
    changedFiles,
    directPackages,
    sharedFiles,
    sharedImpactPackages
  };
}
