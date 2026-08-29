import { parseDiffFileChanges } from './affectedPackages.js';

function escapeRegexCharacter(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

function compilePathPattern(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += escapeRegexCharacter(character);
    }
  }
  return new RegExp(`${source}$`);
}

function matchesPath(filePath, pattern) {
  return compilePathPattern(pattern).test(filePath);
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

function sortFiles(files) {
  return files.sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.role.localeCompare(right.role)
    || left.status.localeCompare(right.status)
  );
}

function packageSummary(packageRecord, reasons = [], files = []) {
  return {
    id: packageRecord.id,
    root: packageRecord.root,
    reasons: [...new Set(reasons)].sort(),
    files: sortFiles(files)
  };
}

function emptyGraph(metadata, status = metadata?.status || 'not-provided') {
  return {
    status,
    sourcePath: metadata?.sourcePath || null,
    directPackages: [],
    transitivePackages: [],
    repositoryWidePackages: [],
    generatedFiles: [],
    unknownFiles: [],
    edges: [],
    diagnostics: []
  };
}

function packageRootOwner(filePath, packages) {
  const matches = packages.filter((entry) =>
    entry.root === '.'
    || filePath === entry.root
    || filePath.startsWith(`${entry.root}/`)
  );
  if (!matches.length) return null;
  return matches.sort((left, right) => right.root.length - left.root.length || left.id.localeCompare(right.id))[0];
}

function cycleDiagnostics(packages) {
  const dependencies = new Map(packages.map((entry) => [entry.id, entry.dependsOn]));
  const state = new Map();
  const stack = [];
  const cycles = new Set();

  function visit(packageId) {
    if (state.get(packageId) === 'done') return;
    if (state.get(packageId) === 'active') {
      const start = stack.indexOf(packageId);
      const cycle = [...stack.slice(start), packageId];
      cycles.add(cycle.join(' -> '));
      return;
    }
    state.set(packageId, 'active');
    stack.push(packageId);
    for (const dependencyId of dependencies.get(packageId) || []) visit(dependencyId);
    stack.pop();
    state.set(packageId, 'done');
  }

  for (const packageId of [...dependencies.keys()].sort()) visit(packageId);
  return [...cycles].sort().map((cycle) => ({
    severity: 'warning',
    code: 'dependency-cycle',
    path: '$.packages',
    message: `Declared dependency cycle: ${cycle}. Impact remains evidence-based, but no execution order is inferred.`
  }));
}

function addPackageEvidence(target, packageRecord, reason, file) {
  if (!target.has(packageRecord.id)) target.set(packageRecord.id, { packageRecord, reasons: [], files: [] });
  const entry = target.get(packageRecord.id);
  entry.reasons.push(reason);
  entry.files.push({ ...file });
}

function summarizeEvidence(evidence) {
  return [...evidence.values()]
    .map((entry) => packageSummary(entry.packageRecord, entry.reasons, entry.files))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function buildImpactGraph(diffText, metadata) {
  if (metadata?.status === 'invalid') {
    const graph = emptyGraph(metadata, 'unknown');
    graph.diagnostics.push({
      severity: 'warning',
      code: 'impact-metadata-invalid',
      path: '$impactGraph',
      message: 'Impact graph is unknown because the explicitly selected impact metadata is invalid.'
    });
    return graph;
  }
  if (metadata?.status !== 'valid') return emptyGraph(metadata);

  const graph = emptyGraph(metadata, 'complete');
  const packages = metadata.packages || [];
  const packageById = new Map(packages.map((entry) => [entry.id, entry]));
  const direct = new Map();
  const repositoryWide = new Map();
  const seenFiles = new Set();

  graph.diagnostics.push(...cycleDiagnostics(packages));

  for (const change of parseDiffFileChanges(diffText)) {
    for (const file of changeEndpoints(change)) {
      const fileKey = `${file.role}\0${file.path}`;
      if (seenFiles.has(fileKey)) continue;
      seenFiles.add(fileKey);

      const widePatterns = metadata.repositoryWidePaths.filter((pattern) => matchesPath(file.path, pattern));
      if (widePatterns.length) {
        const reason = `changed path matches repository-wide metadata pattern ${widePatterns.sort()[0]}`;
        for (const packageRecord of packages) addPackageEvidence(repositoryWide, packageRecord, reason, file);
        continue;
      }

      const generatedMatches = metadata.generatedPaths.filter((entry) => matchesPath(file.path, entry.path));
      if (generatedMatches.length > 1) {
        graph.unknownFiles.push({ ...file, reason: 'changed path matches multiple generated-path records' });
        graph.diagnostics.push({ severity: 'warning', code: 'ambiguous-generated-path', path: file.path, message: `Changed path ${file.path} matches multiple generated-path records.` });
        continue;
      }
      if (generatedMatches.length === 1) {
        const generated = generatedMatches[0];
        const packageRecord = packageById.get(generated.package);
        const reason = `generated path matches ${generated.path}; source: ${generated.source}`;
        graph.generatedFiles.push({ ...file, package: generated.package, pattern: generated.path, source: generated.source, reason });
        addPackageEvidence(direct, packageRecord, reason, file);
        continue;
      }

      const ownershipMatches = metadata.ownership.filter((entry) => matchesPath(file.path, entry.path));
      const ownershipSets = new Map(ownershipMatches.map((entry) => [entry.packages.join('\0'), entry]));
      if (ownershipSets.size > 1) {
        graph.unknownFiles.push({ ...file, reason: 'changed path has ambiguous explicit ownership' });
        graph.diagnostics.push({ severity: 'warning', code: 'ambiguous-ownership', path: file.path, message: `Changed path ${file.path} matches ownership records with different package sets.` });
        continue;
      }
      if (ownershipMatches.length) {
        const ownership = [...ownershipSets.values()][0];
        for (const packageId of ownership.packages) {
          addPackageEvidence(direct, packageById.get(packageId), `changed path matches ownership metadata pattern ${ownership.path}`, file);
        }
        continue;
      }

      const owner = packageRootOwner(file.path, packages);
      if (owner) {
        addPackageEvidence(direct, owner, `changed path is inside explicit package root ${owner.root}`, file);
      } else {
        graph.unknownFiles.push({ ...file, reason: 'no explicit impact-metadata ownership matched the changed path' });
      }
    }
  }

  const reverseDependencies = new Map(packages.map((entry) => [entry.id, []]));
  for (const packageRecord of packages) {
    for (const dependencyId of packageRecord.dependsOn) {
      reverseDependencies.get(dependencyId)?.push(packageRecord.id);
    }
  }
  for (const dependents of reverseDependencies.values()) dependents.sort();

  const directIds = new Set(direct.keys());
  const wideIds = new Set(repositoryWide.keys());
  const transitive = new Map();
  const queue = [...directIds].sort().map((id) => ({ id, origin: id }));
  const traversed = new Set();
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    for (const dependentId of reverseDependencies.get(current.id) || []) {
      const edgeKey = `${dependentId}\0${current.id}`;
      if (!traversed.has(edgeKey)) {
        traversed.add(edgeKey);
        graph.edges.push({
          from: dependentId,
          to: current.id,
          source: metadata.sourcePath,
          reason: `${dependentId} explicitly declares dependsOn ${current.id}`
        });
      }
      if (!directIds.has(dependentId) && !wideIds.has(dependentId) && !transitive.has(dependentId)) {
        transitive.set(dependentId, {
          packageRecord: packageById.get(dependentId),
          reasons: [`depends transitively on directly impacted package ${current.origin} through ${current.id}`],
          files: []
        });
      }
      const visitKey = `${current.origin}\0${dependentId}`;
      if (!traversed.has(`visit\0${visitKey}`)) {
        traversed.add(`visit\0${visitKey}`);
        queue.push({ id: dependentId, origin: current.origin });
      }
    }
  }

  graph.directPackages = summarizeEvidence(direct);
  graph.transitivePackages = summarizeEvidence(transitive);
  graph.repositoryWidePackages = summarizeEvidence(repositoryWide);
  graph.generatedFiles.sort((left, right) => left.path.localeCompare(right.path) || left.role.localeCompare(right.role));
  sortFiles(graph.unknownFiles);
  graph.edges.sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
  graph.diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  if (graph.unknownFiles.length || graph.diagnostics.length) graph.status = 'partial';
  return graph;
}
