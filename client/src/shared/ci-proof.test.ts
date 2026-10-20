// Temporary test of the 16.3 proof: it fails on purpose, so that the shard it lands in and `verify` fail. Reverted after the red run.
describe('16.3 proof', () => {
  it('fails on purpose', () => {
    expect(1 + 1).toBe(3)
  })
})
