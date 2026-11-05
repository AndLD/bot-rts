// The usage of this runtime (contract role "usage", optional): how an orchestrator of a flow reads the account's usage windows, and the coefficients that
// turn a step into a share of them. Return `{ means, read(), plans, subscriptions, defaultModel }`: `read()` is a list of means (`{ via, tool, input, reads? }`,
// `{ via, command, reads? }` or `{ via, owner }`), the owner at least; `plans` maps the plan name the runtime reports to a subscription id; each subscription is
// `{ label, unit: 'percent' | 'usd', kinds: { <step kind>: <factor> }, perSp: { <model family>: { default: { fiveHour, weekly } | { usd } } } }`.
// A runtime that cannot read usage leaves the role out, and the framework asks the owner.
export function usageFor(profile) {
  throw new Error('TODO: the usage of this runtime')
}
