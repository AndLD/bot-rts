export const LINK_GATE = Symbol('LinkGate')

// Whether a bot may be controlled from the player's side: it must reach the base through the radio network (design §11.2.1).
// Throws NO_SIGNAL when it does not.
export interface LinkGate {
  ensureConnected(userId: string, botId: string): Promise<void>
}

// The gate when there is no engine to know the network: everything is within reach
export class OpenLinkGate implements LinkGate {
  async ensureConnected(): Promise<void> {
    return undefined
  }
}
