// The values of the project profile for the scripts and hooks of this repository, read from harness-profile.json at the root by the
// framework's reader (harness/tools/lib/profile.mjs), so that each value lives once. The shell files and workflows use
// `node harness/tools/harness.mjs profile get <role>` instead.
import { resolve } from 'node:path'
import { loadProfile } from '../harness/tools/lib/profile.mjs'

export const root = resolve(import.meta.dirname, '..')
export const profile = loadProfile(root)
export const protectedBranches = [profile.branches.production, profile.branches.integration]
