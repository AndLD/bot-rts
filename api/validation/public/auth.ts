import { user } from './users'

export const authPublicValidationSchemas = {
    postLogin: {
        bodySchema: {
            _allowedProps: ['email', 'password'],
            email: user.email,
            password: user.password
        }
    }
}
