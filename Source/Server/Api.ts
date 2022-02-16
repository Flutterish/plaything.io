import type { SessionKey } from "./Session";

export type Uncertain<T> = { [K in keyof Omit<T, 'type'>]: K extends 'id' ? T[K] : T[K] | undefined };
export type ID<T> = T & { id: number };

export type DistributiveOmit<T, K extends keyof any> = T extends any
    ? Omit<T, K>
    : never;

export type RequestResponseMap = {
    [Req in API.Request['type']]: 
        Req extends API.RequestLoginInfo['type'] ? API.ResponseLoginInfo
        : Req extends API.RequestLogin['type'] ? API.ResponseLogin
        : Req extends API.RequestServerInfo['type'] ? API.ResponseServerInfo
        : Req extends API.RequestLogout['type'] ? API.ResponseLogout
        : Req extends API.RequestSessionReconnect['type'] ? API.ResponseSessionExists
        : Req extends API.SubscribeDevices['type'] ? API.ResponseSubscribeDevices
        : Req extends API.SubscribeUsers['type'] ? API.ResponseSubscribeUsers
        : Req extends API.RequestLoadPreferences['type'] ? API.ResponseLoadPreferences
        : Req extends API.RequestSavePreferences['type'] ? API.Ack | API.InvalidSession
        : API.Ack
};

export namespace API {
    export type InvalidSession = { result: 'session not found' }
    export type SessionRequest = { sessionKey?: SessionKey }
    export type RequestLoginInfo = {
        type: 'loginInformation'
    }
    export type RequestServerInfo = {
        type: 'serverInformation'
    }
    export type RequestLogin = {
        type: 'login',
        nickname: string,
        password?: string
    }
    export type RequestLogout = {
        type: 'logout'
    } & SessionRequest
    export type RequestSessionReconnect = {
        type: 'reconnect'
    } & SessionRequest
    export type RequestSavePreferences = {
        type: 'save-prefereces',
        theme?: string,
        accent?: string
    } & SessionRequest
    export type RequestLoadPreferences = {
        type: 'load-preferences'
    } & SessionRequest
    export type SubscribeDevices = {
        type: 'subscibeDevices'
    } & SessionRequest
    export type SubscribeUsers = {
        type: 'subscibeUsers'
    } & SessionRequest
    export type AliveAck = {
        type: 'alive'
    } & SessionRequest

    type RequestTypes = 
        RequestLoginInfo | RequestServerInfo 
        | RequestLogin | RequestLogout | RequestSessionReconnect 
        | SubscribeDevices | SubscribeUsers 
        | RequestSavePreferences | RequestLoadPreferences;

    export type Request = Extract<RequestTypes, {type: string}>
    type MessageTypes = AliveAck
    export type Message = Extract<MessageTypes, {type: string}>

    export type ResponseLoginInfo = {
        anonymousAllowed: boolean
    }
    export type ResponseServerInfo = {
        name: string
    }
    export type ResponseLogin = {
        result: 'ok',
        sessionKey: SessionKey
    } | {
        result: 'invalid',
        reason: 'nickname and password required' | 'nickname required' | 'password required' | 'invalid credentials'
    }
    export type ResponseLogout = {
        result: 'ok' | 'session not found'
    }
    export type ResponseSessionExists = {
        value: boolean
    }
    export type ResponseSubscribeDevices = {
        result: 'ok',
        devices: string[]
    } | InvalidSession
    export type ResponseSubscribeUsers = {
        result: 'ok',
        users: { nickname: string, location: string, uid: number, accent: string }[]
    } | InvalidSession
    export type ResponseLoadPreferences = {
        result: 'ok',
        theme?: string,
        accent?: string
    } | InvalidSession
    export type Ack = { result: boolean }
    export type Error = {
        error: string
    }
    type ResponseTypes = RequestResponseMap[keyof RequestResponseMap] | Error
    export type Response = ResponseTypes

    export type HeartbeatDevices = {
        type: 'heartbeat-devices',
        kind: 'added' | 'removed',
        value: string[]
    }
    export type HeartbeatUsers = {
        type: 'heartbeat-users'
    } & ({
        kind: 'added' | 'updated',
        user: { nickname: string, location: string, uid: number, accent: string }
    } | {
        kind: 'removed',
        uid: number
    })
    type HeartbeatTypes = HeartbeatDevices | HeartbeatUsers
    export type Heartbeat = Exclude<HeartbeatTypes, {id: number}>
};