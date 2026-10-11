import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { errorNotification } from '../../shared/notifications'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import DeployBase from './DeployBase'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
jest.mock('../../shared/notifications', () => ({ errorNotification: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

// Sets whole values at once: typing key by key through the antd inputs is slow on a busy machine
async function fill(password: string, confirmation = password, seed = '') {
  fireEvent.change(screen.getByLabelText('Base password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: confirmation } })
  if (seed) {
    fireEvent.change(screen.getByLabelText('Spawn seed (optional)'), { target: { value: seed } })
  }
  await userEvent.click(screen.getByText('Deploy base'))
}

describe('DeployBase', () => {
  beforeEach(() => {
    query.mockReset()
    jest.mocked(errorNotification).mockClear()
    renderApp(<DeployBase />, { store: storeWithToken(makeJwt(60)) })
  })

  it('wants a password of the right length, repeated', async () => {
    await userEvent.click(screen.getByText('Deploy base'))
    expect(await screen.findByText('Please enter a password for your base')).toBeInTheDocument()
    expect(screen.getByText('Please repeat the password')).toBeInTheDocument()

    await fill('abc')
    expect(await screen.findByText('The password must have 6-64 characters')).toBeInTheDocument()
    expect(screen.queryByText('Deploy your base?')).not.toBeInTheDocument()
  })

  it('refuses a malformed spawn seed', async () => {
    await fill('secret1', 'secret1', 'x')

    expect(await screen.findByText('3-24 letters, digits or dashes, for example ALPHA-7K2')).toBeInTheDocument()
    expect(query).not.toHaveBeenCalled()
  })

  it('sends the spawn seed with the password when there is one', async () => {
    query.mockResolvedValue({ data: {} })
    await fill('secret1', 'secret1', ' ALPHA-7K2 ')

    await userEvent.click(await screen.findByText('Deploy', { selector: '.ant-modal button span' }))

    await waitFor(() =>
      expect(query).toHaveBeenCalledWith(
        { method: 'POST', url: '/api/v1/bots/base', body: { password: 'secret1', spawnSeed: 'ALPHA-7K2' } },
        expect.anything(),
        undefined
      )
    )
  })

  it('refuses a repetition that differs', async () => {
    await fill('secret1', 'secret2')

    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument()
    expect(query).not.toHaveBeenCalled()
  })

  it('asks for confirmation, and deploys nothing when the player cancels', async () => {
    await fill('secret1')

    expect(await screen.findByText('Deploy your base?')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Cancel'))

    await waitFor(() => expect(screen.queryByText('Deploy your base?')).not.toBeVisible())
    expect(query).not.toHaveBeenCalled()
  })

  it('deploys the base with the password once confirmed', async () => {
    query.mockResolvedValue({ data: {} })
    await fill('secret1')

    await userEvent.click(await screen.findByText('Deploy', { selector: '.ant-modal button span' }))

    await waitFor(() =>
      expect(query).toHaveBeenCalledWith(
        { method: 'POST', url: '/api/v1/bots/base', body: { password: 'secret1' } },
        expect.anything(),
        undefined
      )
    )
    expect(errorNotification).not.toHaveBeenCalled()
  })

  it('tells the player why the base was not deployed', async () => {
    query.mockResolvedValue({ error: { status: 403, data: { code: 'BASE_ALREADY_EXISTS', error: 'exists' } } })
    await fill('secret1')

    await userEvent.click(await screen.findByText('Deploy', { selector: '.ant-modal button span' }))

    await waitFor(() =>
      expect(errorNotification).toHaveBeenCalledWith('You already have a base', 'The base was not deployed')
    )
  })

  it('falls back to the generic message when the server sends none', async () => {
    query.mockResolvedValue({ error: { status: 500, data: undefined } as never })
    await fill('secret1')

    await userEvent.click(await screen.findByText('Deploy', { selector: '.ant-modal button span' }))

    await waitFor(() =>
      expect(errorNotification).toHaveBeenCalledWith('Something went wrong', 'The base was not deployed')
    )
  })
})
