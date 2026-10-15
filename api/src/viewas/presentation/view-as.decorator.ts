import { SetMetadata } from '@nestjs/common'

export const ALLOW_IN_VIEW_AS_KEY = 'allowInViewAs'
export const VIEW_AS_AUDIT_KEY = 'viewAsAudit'

// A route that a "view as player" session may call although it is not a read (leaving the view)
export const AllowInViewAs = () => SetMetadata(ALLOW_IN_VIEW_AS_KEY, true)

// A read of sensitive data (a player's files, terminal history): in a view it is written to the audit trail with the admin as
// the actor, as the inspector does
export const ViewAsAudited = (action: string) => SetMetadata(VIEW_AS_AUDIT_KEY, action)
