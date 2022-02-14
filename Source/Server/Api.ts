type ID<T> = T & { id: number };

export namespace API {
    export type RequestLoginInfo = ID<{
        type: 'loginInformation'
    }>
    type RequestTypes = RequestLoginInfo;
    export type Request = Extract<RequestTypes, ID<{type: string }>>

    export type ResponseLoginInfo = ID<{
        anonymousAllowed: boolean
    }>
    export type Error = ID<{
        error: string
    }>
    type ResponseTypes = ResponseLoginInfo | Error
    export type Response = Extract<ResponseTypes, ID<{}>>
};