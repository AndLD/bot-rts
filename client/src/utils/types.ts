export type ID = string

export type Error = {
  msg: string
  code: number
}

export type Item = any
export type ItemType = Resource

export type Resource = Ore | Fluid
export type Ore = 'ironOre' | 'goldOre'
export type Fluid = 'water' | 'rawOil' | 'oil'
export type Material = 'iron' | 'gold' | 'aluminium'
