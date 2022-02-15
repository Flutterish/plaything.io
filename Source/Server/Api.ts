import type { SessionKey } from "./Session";

export type Uncertain<T> = { [K in keyof Omit<T, 'type'>]: K extends 'id' ? T[K] : T[K] | undefined };
type ID<T> = T & { id: number };

export type DistributiveOmit<T, K extends keyof any> = T extends any
    ? Omit<T, K>
    : never;

export type RequestResponseMap = {
    [Req in API.Request['type']]: 
        Req extends API.RequestLoginInfo['type'] ? API.ResponseLoginInfo
        : Req extends API.RequestLogin['type'] ? API.ResponseLogin
        : Req extends API.RequestServerInfo['type'] ? API.ResponseServerInfo
        : Req extends API.RequestLogout['type'] ? API.ResponseLogout
        : Req extends API.RequestSessionExists['type'] ? API.ResponseSesssionExists
        : never
};

export namespace API {
    export type RequestLoginInfo = ID<{
        type: 'loginInformation'
    }>
    export type RequestServerInfo = ID<{
        type: 'serverInformation'
    }>
    export type RequestLogin = ID<{
        type: 'login',
        nickname: string,
        password?: string
    }>
    export type RequestLogout = ID<{
        type: 'logout',
        sessionKey: SessionKey
    }>
    export type RequestSessionExists = ID<{
        type: 'sessionExists',
        sessionKey: SessionKey
    }>
    type RequestTypes = RequestLoginInfo | RequestLogin | RequestServerInfo | RequestLogout | RequestSessionExists;
    export type Request = Extract<RequestTypes, ID<{type: string}>>

    export type ResponseLoginInfo = ID<{
        anonymousAllowed: boolean
    }>
    export type ResponseServerInfo = ID<{
        name: string
    }>
    export type ResponseLogin = ID<{
        result: 'ok',
        sessionKey: SessionKey
    } | {
        result: 'invalid',
        reason: 'nickname and password required' | 'nickname required' | 'password required' | 'invalid credentials'
    }>
    export type ResponseLogout = ID<{
        result: 'ok' | 'session not found'
    }>
    export type ResponseSesssionExists = ID<{
        value: boolean
    }>
    export type Error = ID<{
        error: string
    }>
    type ResponseTypes = RequestResponseMap[keyof RequestResponseMap] | Error
    export type Response = Extract<ResponseTypes, ID<{}>>
};