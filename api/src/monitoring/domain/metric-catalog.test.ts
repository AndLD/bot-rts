import { ALERT_RULES, evaluateRule, METRIC_CATALOG, worstOf } from './metric-catalog'

const rule = (metric: string) => ALERT_RULES.find((candidate) => candidate.metric === metric)!

describe('evaluateRule', () => {
  it('compares above and below, and the red limit wins', () => {
    const above = rule('api.errorRate5xx')

    expect(evaluateRule(above, { yellow: 0.01, red: 0.05 }, 0.005)).toBeNull()
    expect(evaluateRule(above, { yellow: 0.01, red: 0.05 }, 0.02)).toEqual({ severity: 'yellow', threshold: 0.01 })
    expect(evaluateRule(above, { yellow: 0.01, red: 0.05 }, 0.5)).toEqual({ severity: 'red', threshold: 0.05 })
    expect(evaluateRule(above, { red: 0.05 }, 0.02)).toBeNull()
    expect(evaluateRule(rule('engine.up'), { red: 1 }, 0)).toEqual({ severity: 'red', threshold: 1 })
    expect(evaluateRule(rule('engine.up'), { red: 1 }, 1)).toBeNull()
  })
})

describe('worstOf', () => {
  it('picks the worst status', () => {
    expect(worstOf([])).toBe('green')
    expect(worstOf(['green', 'yellow'])).toBe('yellow')
    expect(worstOf(['yellow', 'red', 'green'])).toBe('red')
  })
})

describe('the catalog', () => {
  it('has a metric for every rule and unique ids', () => {
    const ids = METRIC_CATALOG.map((metric) => metric.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const alertRule of ALERT_RULES) {
      expect(ids).toContain(alertRule.metric)
    }
  })
})
