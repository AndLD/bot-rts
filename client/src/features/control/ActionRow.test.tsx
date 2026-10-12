import { findScriptFunction } from '@lib/utils/script-api'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import ActionRow from './ActionRow'

const spec = (name: string) => findScriptFunction(name) as NonNullable<ReturnType<typeof findScriptFunction>>
const modules = [
  { _id: 'm1', name: 'scanner-class1' },
  { _id: 'm2', name: 'gun-class1' }
]

function setup(name: string, options: { isDisabled?: boolean; outcome?: object } = {}) {
  const perform = jest.fn().mockResolvedValue(options.outcome ?? { ok: true })
  renderApp(
    <ActionRow spec={spec(name)} isDisabled={options.isDisabled ?? false} modules={modules} perform={perform} />
  )

  return perform
}

const run = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Do ${name}` }))

describe('ActionRow', () => {
  it('does an action with the typed arguments and says it is done', async () => {
    const perform = setup('shoot')

    fireEvent.change(screen.getByLabelText('shoot x'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('shoot y'), { target: { value: '-2' } })
    run('shoot')

    await waitFor(() => expect(perform).toHaveBeenCalledWith('shoot', [4, -2]))
    expect(await screen.findByRole('status')).toHaveTextContent('Done')
  })

  it('shows what the call returned', async () => {
    setup('pick', { outcome: { ok: true, data: { id: 'i1', name: 'part' } } })

    run('pick')

    expect(await screen.findByRole('status')).toHaveTextContent('Done: {"id":"i1","name":"part"}')
  })

  it('says why a call failed, in red', async () => {
    setup('pick', { outcome: { ok: false, message: 'The way is blocked' } })

    run('pick')

    expect(await screen.findByText('The way is blocked')).toBeInTheDocument()
  })

  it('does not send an action whose argument is missing or wrong', async () => {
    const perform = setup('move')

    run('move')
    expect(await screen.findByText('cells is needed')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('move cells'), { target: { value: 'x' } })
    run('move')
    expect(await screen.findByText('cells must be a whole number')).toBeInTheDocument()
    expect(perform).not.toHaveBeenCalled()
  })

  it('offers the bot modules for an action that names one, and left and right for a turn', async () => {
    const perform = setup('enable')

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'enable moduleId' }))
    fireEvent.click(await screen.findByText('gun-class1', { selector: '.ant-select-item-option-content' }))
    run('enable')

    await waitFor(() => expect(perform).toHaveBeenCalledWith('enable', ['m2']))
  })

  it('turns left or right', async () => {
    const perform = setup('turn')

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'turn direction' }))
    fireEvent.click(await screen.findByText('right', { selector: '.ant-select-item-option-content' }))
    run('turn')

    await waitFor(() => expect(perform).toHaveBeenCalledWith('turn', ['right']))
  })

  it('cannot be used while its category is switched off', () => {
    const perform = setup('move', { isDisabled: true })

    expect(screen.getByLabelText('move cells')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Do move' })).toBeDisabled()
    expect(perform).not.toHaveBeenCalled()
  })

  it('takes a name as text', async () => {
    const perform = setup('research')

    fireEvent.change(screen.getByLabelText('research module'), { target: { value: 'gun-class2' } })
    run('research')

    await waitFor(() => expect(perform).toHaveBeenCalledWith('research', ['gun-class2']))
  })

  it('marks an optional argument', () => {
    setup('drop')

    expect(screen.getByLabelText('drop x')).toHaveAttribute('placeholder', 'x?')
  })
})
