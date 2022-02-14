type ID<T> = T & { id: number };

export namespace API {
    export type RequestLoginInfo = ID<{
        type: 'loginInformation'
    }>
    export type Request = RequestLoginInfo

    export type ResponseLoginInfo = ID<{
        anonymousAllowed: boolean
    }>
    export type Error = ID<{
        error: string
    }>
    export type Response = ResponseLoginInfo | Error
};