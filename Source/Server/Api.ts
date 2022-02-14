import type { SessionKey } from "./Session";
import type { UserSession } from "./Users";

export type Uncertain<T> = { [K in keyof Omit<T, 'type'>]: K extends 'id' ? T[K] : T[K] | undefined };
type ID<T> = T & { id: number };

export type DistributiveOmit<T, K extends keyof any> = T extends any
    ? Omit<T, K>
    : never;

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
        password?: string
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
        result: 'invalid',
        reason: 'nickname and password required' | 'nickname required' | 'password required' | 'invalid credentials'
    }>
    export type Error = ID<{
        error: string
    }>
    type ResponseTypes = RequestResponseMap[keyof RequestResponseMap] | Error
    export type Response = Extract<ResponseTypes, ID<{}>>
};