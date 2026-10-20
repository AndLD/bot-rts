// Temporary file of the 16.3 proof: a small untested file, which the changed-file coverage gate must fail. Reverted after the red run.
export function proofClassify(value: number): string {
  if (value < 0) {
    return 'negative'
  }

  if (value === 0) {
    return 'zero'
  }

  return value < 10 ? 'small' : 'large'
}
