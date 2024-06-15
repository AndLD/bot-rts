export interface IAuthPostBody {
    email: string
    password: string
}

export interface IAuthPostResponse {
    result: string
}

export interface IRefreshPostResponse {
    result: string
}
