import type { SessionKey } from "./Session";
import type { UserSession } from "./Users";

type ID<T> = T & { id: number };

export type RequestResponseMap = {
    [Req in API.Request['type']]: 
        Req extends API.RequestLoginInfo['type'] ? API.ResponseLoginInfo
        : Req extends API.RequestLogin['type'] ? API.ResponseLogin
        : never
};

export namespace API {
    export type RequestLoginInfo = ID<{
        type: 'loginInformation'
    }>
    export type RequestLogin = ID<{
        type: 'login',
        nickname: string,
        password: string
    }>
    type RequestTypes = RequestLoginInfo | RequestLogin;
    export type Request = Extract<RequestTypes, ID<{type: string}>>

    export type ResponseLoginInfo = ID<{
        anonymousAllowed: boolean
    }>
    export type ResponseLogin = ID<{
        result: 'ok',
        sessionKey: SessionKey,
        session: UserSession
    } | {
        result: 'invalid'
    }>
    export type Error = ID<{
        error: string
    }>
    type ResponseTypes = RequestResponseMap[keyof RequestResponseMap] | Error
    export type Response = Extract<ResponseTypes, ID<{}>>
};