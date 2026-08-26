export function analyze(input) {
  return { findings: input.diff ? [{ id: 'example.rule', label: 'Example plugin finding', weight: 1 }] : [] };
}
