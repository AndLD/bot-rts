import { notification } from 'antd'
import { errorNotification } from './notifications'

describe('errorNotification', () => {
  it('shows an error with the description and the title', () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)

    errorNotification('details', 'title')

    expect(error).toHaveBeenCalledWith({ message: 'title', description: 'details' })
  })
})
