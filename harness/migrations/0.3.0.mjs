// Migration to 0.3.0: the release order moves out of the plan index into a file of its own (task 5.1). A table in the section "Order of development" of the
// index becomes the releases file, the profile file gains `paths.releases`, and the section becomes the generated block; an order written in prose is left
// as it is, with a message that the migration note turns into a required action. A project with no such section, or with the role already, is not changed.
import { moveReleaseOrder } from '../tools/lib/releases-migration.mjs'

export default ({ root, profile }) => moveReleaseOrder({ root, profile })
