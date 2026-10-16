import { deserialize, serialize } from 'v8'
import { EngineReplyData, EngineRequest, SerializedError } from '../../engine/application/engine-protocol'

// The link between API nodes and the engine node (design §12.2.2, "Scaling"): the same request/reply protocol as between
// the API thread and the engine thread, carried by Redis pub/sub. The payload is V8-serialized, which keeps dates and maps.
export const ENGINE_REQUEST_CHANNEL = 'botrts:engine:requests'
export const engineReplyChannel = (nodeId: string) => `botrts:engine:replies:${nodeId}`

export interface LinkRequest {
  id: string
  replyTo: string
  request: EngineRequest
  // The trace context of the API node's call (W3C `traceparent`)
  traceparent?: string
}

export type LinkReply = { id: string; data: EngineReplyData } | { id: string; error: SerializedError }

export const encode = (message: LinkRequest | LinkReply): Buffer => serialize(message)
export const decode = <T>(payload: Buffer): T => deserialize(payload) as T
