import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { notification } from 'antd'

export const errorNotification = (description: string, message?: string) =>
    notification.error({
        message: message || 'Error',
        description
    })

export const handleError = (
    error: FetchBaseQueryError | SerializedError,
    defaultMessage: string
) => {
    if (error) {
        const _error = error as FetchBaseQueryError
        const status = (_error as FetchBaseQueryError).status
        const message = (_error.data as Error)?.message

        errorNotification(`${status} ${message || defaultMessage}`)
    }
}

export const successNotification = (description: string, message?: string) =>
    notification.success({
        message: message || 'Success',
        description
    })

export const warningNotification = (description: string, message?: string) =>
    notification.warning({
        message: message || 'Warning',
        description
    })

export const infoNotification = (description: string, message?: string) =>
    notification.info({
        message: message || 'Info',
        description,
        duration: 0
    })
