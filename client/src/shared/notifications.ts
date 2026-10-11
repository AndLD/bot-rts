import { notification } from 'antd'

export const errorNotification = (description: string, message?: string) =>
  notification.error({
    message,
    description
  })
