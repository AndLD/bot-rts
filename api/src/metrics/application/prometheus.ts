export type Labels = Record<string, string | number>

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')

const labelText = (labels: Labels) => {
  const pairs = Object.entries(labels).map(([name, value]) => `${name}="${escape(String(value))}"`)
  return pairs.length ? `{${pairs.join(',')}}` : ''
}

// Builds the Prometheus text exposition format (version 0.0.4), one family at a time
export class PrometheusText {
  private readonly lines: string[] = []

  family(name: string, type: 'gauge' | 'counter' | 'histogram', help: string): this {
    this.lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`)
    return this
  }

  sample(name: string, value: number, labels: Labels = {}): this {
    this.lines.push(`${name}${labelText(labels)} ${value}`)
    return this
  }

  toString(): string {
    return `${this.lines.join('\n')}\n`
  }
}
