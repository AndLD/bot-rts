// The managed files (design §6.3): files the tools generate in the project from the vendored tree and the profile file, and check by
// regenerating them. Each generator is `{ path, render({ root, profile }) → string }`. The build tasks add them: the profile document (17.5),
// the layer map (17.6), the entry file's blocks (17.8), the rule-map rows (17.11) and the packaged skills (17.12).
export const generators = []
