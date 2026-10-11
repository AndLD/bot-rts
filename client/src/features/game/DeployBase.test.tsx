import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { errorNotification } from '../../shared/notifications'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import DeployBase from './DeployBase'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
jest.mock('../../shared/notifications', () => ({ errorNotification: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

async function fill(password: string, confirmation = password) {
  await userEvent.type(screen.getByLabelText('Base password'), password)
  await userEvent.type(screen.getByLabelText('Repeat the password'), confirmation)
  await userEvent.click(screen.getByRole('button', { name: 'Deploy base' }))
}

describe('DeployBase', () => {
  beforeEach(() => {
    query.mockReset()
    jest.mocked(errorNotification).mockClear()
    renderApp(<DeployBase />, { store: storeWithToken(makeJwt(60)) })
  })

  it('wants a password of the right length, repeated', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Deploy base' }))
    expect(await screen.findByText('Please enter a password for your base')).toBeInTheDocument()
    expect(screen.getByText('Please repeat the password')).toBeInTheDocument()

    await fill('abc')
    expect(await screen.findByText('The password must have 6-64 characters')).toBeInTheDocument()
    expect(screen.queryByText('Deploy your base?')).not.toBeInTheDocument()
  })

  it('refuses a repetition that differs', async () => {
    await fill('secret1', 'secret2')

    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument()
    expect(query).not.toHaveBeenCalled()
  })

  it('asks for confirmation, and deploys nothing when the player cancels', async () => {
    await fill('secret1')

    expect(await screen.findByText('Deploy your base?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByText('Deploy your base?')).not.toBeVisible())
    expect(query).not.toHaveBeenCalled()
  })

  it('deploys the base with the password once confirmed', async () => {
    query.mockResolvedValue({ data: {} })
    await fill('secret1')

    await userEvent.click(await screen.findByRole('button', { name: 'Deploy' }))

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

    await userEvent.click(await screen.findByRole('button', { name: 'Deploy' }))

    await waitFor(() =>
      expect(errorNotification).toHaveBeenCalledWith('You already have a base', 'The base was not deployed')
    )
  })

  it('falls back to the generic message when the server sends none', async () => {
    query.mockResolvedValue({ error: { status: 500, data: undefined } as never })
    await fill('secret1')

    await userEvent.click(await screen.findByRole('button', { name: 'Deploy' }))

    await waitFor(() =>
      expect(errorNotification).toHaveBeenCalledWith('Something went wrong', 'The base was not deployed')
    )
  })
})
