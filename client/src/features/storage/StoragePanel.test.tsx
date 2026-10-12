import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import StoragePanel from './StoragePanel'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const storage = {
  capacity: 200,
  used: 55,
  resources: [{ resource: 'oil', amount: 50 }],
  items: [{ _id: 'i1', type: 'part', name: 'engine-class1', weight: 2 }],
  carriedWeight: 2,
  loadCapacity: 50
}

function setup(data: object = storage) {
  query.mockReset()
  query.mockImplementation((async (args: { url: string }) =>
    args.url.endsWith('/storage') ? { data } : { data: { ok: true } }) as never)

  return renderApp(<StoragePanel botId="b1" />, { store: storeWithToken(makeJwt(60)) })
}

const actionBodies = () =>
  query.mock.calls.flatMap(([args]) =>
    (args as { url: string }).url.endsWith('/actions') ? [(args as { body: unknown }).body] : []
  )

describe('StoragePanel', () => {
  it('shows what the bot carries', async () => {
    setup()

    expect(await screen.findByText('Storage: 55 of 200')).toBeInTheDocument()
    expect(screen.getByText('Oil: 50')).toBeInTheDocument()
    expect(screen.getByText('Carried 2 kg of 50 kg')).toBeInTheDocument()
    expect(screen.getByText('Part engine-class1 (2 kg)')).toBeInTheDocument()
  })

  it('says when there is nothing, and cannot drop what it does not hold', async () => {
    setup({ ...storage, capacity: 0, used: 0, resources: [], items: [], carriedWeight: 0 })

    expect(await screen.findByText('No resources')).toBeInTheDocument()
    expect(screen.getByText('Nothing in hands')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drop the last item ahead' })).toBeDisabled()
  })

  it('takes and drops by manual actions', async () => {
    setup()

    fireEvent.click(await screen.findByRole('button', { name: 'Take the item ahead' }))
    await waitFor(() => expect(actionBodies()).toContainEqual({ fn: 'take', args: [] }))
    const drop = screen.getByRole('button', { name: 'Drop the last item ahead' })
    await waitFor(() => expect(drop).toBeEnabled())
    fireEvent.click(drop)
    await waitFor(() => expect(actionBodies()).toContainEqual({ fn: 'drop', args: [] }))
  })

  it('tells why an action failed, and clears the message when the next one works', async () => {
    setup()
    query.mockImplementation((async (args: { url: string }) =>
      args.url.endsWith('/storage') ? { data: storage } : { data: { ok: false, code: 'EMPTY' } }) as never)

    fireEvent.click(await screen.findByRole('button', { name: 'Take the item ahead' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough resources, or nothing to do here')

    query.mockImplementation((async (args: { url: string }) =>
      args.url.endsWith('/storage') ? { data: storage } : { data: { ok: true } }) as never)
    fireEvent.click(screen.getByRole('button', { name: 'Take the item ahead' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('says so when the storage cannot be loaded', async () => {
    query.mockReset()
    query.mockResolvedValue({ error: { status: 500, data: {} } })
    renderApp(<StoragePanel botId="b1" />, { store: storeWithToken(makeJwt(60)) })

    expect(await screen.findByText('Could not load the storage')).toBeInTheDocument()
  })

  it('waits for the storage', () => {
    query.mockReset()
    query.mockReturnValue(new Promise(() => undefined) as never)
    renderApp(<StoragePanel botId="b1" />, { store: storeWithToken(makeJwt(60)) })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
