import { IResourceBalance, RESOURCE, RESOURCES, ResourceBalance } from '../../../../lib/utils/interfaces/resources'

// Picks a resource by the spawn weights; `roll` is a uniform number in [0, 1)
export function pickResource(balance: ResourceBalance, roll: number): RESOURCE {
  const total = RESOURCES.reduce((sum, resource) => sum + balance[resource].spawnWeight, 0)
  let threshold = roll * total

  for (const resource of RESOURCES) {
    threshold -= balance[resource].spawnWeight
    if (threshold < 0) {
      return resource
    }
  }
  return RESOURCES[RESOURCES.length - 1]
}

// The fixed amount of a new deposit, within the resource's range (inclusive); `roll` is uniform in [0, 1)
export function rollDepositAmount({ minAmount, maxAmount }: IResourceBalance, roll: number): number {
  return minAmount + Math.floor(roll * (maxAmount - minAmount + 1))
}

// The problems of a balance table, empty when it is usable
export function validateResourceBalance(balance: ResourceBalance): string[] {
  const problems = RESOURCES.flatMap((resource) => {
    const { spawnWeight, minAmount, maxAmount, hardness } = balance[resource]
    const numbers = [spawnWeight, minAmount, maxAmount, hardness]
    if (!numbers.every((value) => Number.isFinite(value) && value >= 0)) {
      return [`${resource}: every number must be zero or positive`]
    }
    return minAmount > maxAmount ? [`${resource}: minAmount must not exceed maxAmount`] : []
  })

  if (!problems.length && RESOURCES.every((resource) => balance[resource].spawnWeight === 0)) {
    problems.push('at least one resource needs a spawn weight above zero')
  }
  return problems
}
