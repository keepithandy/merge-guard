import { mapChangedFilesToPackages } from './affectedPackages.js';
import { buildImpactGraph } from './impactGraph.js';
import { loadImpactMetadata } from './impactMetadata.js';
import { applyProjectChecks, detectProjectCheckDetails } from './projectChecks.js';
import { detectNpmWorkspaces } from './workspaces.js';

export function inspectRepository(diffText, cwd = process.cwd(), impactMetadataPath = null) {
  const workspaceModel = detectNpmWorkspaces(cwd);
  const impactMetadata = loadImpactMetadata(cwd, impactMetadataPath);

  return {
    kind: workspaceModel.kind,
    rootPackage: workspaceModel.rootPackage,
    workspacePatterns: workspaceModel.workspacePatterns,
    packages: workspaceModel.packages,
    warnings: workspaceModel.warnings,
    impactMetadata,
    impactGraph: buildImpactGraph(diffText, impactMetadata),
    affectedPackages: mapChangedFilesToPackages(diffText, workspaceModel),
    projectCheckDetails: detectProjectCheckDetails(cwd)
  };
}

export function applyRepositoryIntelligence(report, intelligence) {
  const normalized = intelligence && typeof intelligence === 'object'
    ? intelligence
    : {};
  const {
    projectCheckDetails = [],
    kind = 'unknown',
    rootPackage = null,
    workspacePatterns = [],
    packages = [],
    warnings = [],
    impactMetadata = {
      status: 'not-provided',
      sourcePath: null,
      schemaVersion: null,
      packages: [],
      ownership: [],
      generatedPaths: [],
      repositoryWidePaths: [],
      diagnostics: []
    },
    impactGraph = {
      status: 'not-provided',
      sourcePath: null,
      directPackages: [],
      transitivePackages: [],
      repositoryWidePackages: [],
      generatedFiles: [],
      unknownFiles: [],
      edges: [],
      diagnostics: []
    },
    affectedPackages = {
      changedFiles: [],
      directPackages: [],
      sharedFiles: [],
      sharedImpactPackages: []
    }
  } = normalized;

  report.repository = {
    kind,
    rootPackage,
    workspacePatterns,
    packages,
    warnings,
    impactMetadata,
    impactGraph,
    affectedPackages
  };

  return applyProjectChecks(report, projectCheckDetails);
}
