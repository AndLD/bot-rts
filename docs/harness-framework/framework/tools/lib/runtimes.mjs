// The agent-runtime adapters present in this copy of the framework (design §4.2), loaded once with the modules their roles name.
import { loadAdapterModules } from './adapters.mjs'

export const ADAPTER_RUNTIMES = await loadAdapterModules('runtime')
