import { fireEvent, render, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../../messages/en.json'
import ActionModal from './ActionModal'

const modal = (isOpen: boolean) => (
  <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
    <ActionModal
      title="Do it"
      isOpen={isOpen}
      isLoading={false}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  </NextIntlClientProvider>
)

describe('ActionModal', () => {
  it('starts every action with an empty reason, not with the one of the last action', async () => {
    const { rerender } = render(modal(true))
    const reason = () => document.querySelector('.ant-modal textarea') as HTMLTextAreaElement

    fireEvent.change(reason(), { target: { value: 'the first reason' } })
    expect(reason().value).toBe('the first reason')

    rerender(modal(false))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull(), { timeout: 5000 })
    rerender(modal(true))

    await waitFor(() => expect(reason()).not.toBeNull())
    expect(reason().value).toBe('')
  })
})
