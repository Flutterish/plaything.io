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
        : Req extends API.RequestSessionReconnect['type'] ? API.ResponseSesssionExists
        : Req extends API.SubscribeDevices['type'] ? API.ResponseSubscribeDevices
        : Req extends API.SubscribeUsers['type'] ? API.ResponseSubscribeUsers
        : API.Ack
};

export namespace API {
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
        type: 'logout',
        sessionKey?: SessionKey
    }
    export type RequestSessionReconnect = {
        type: 'reconnect',
        sessionKey: SessionKey
    }
    export type SubscribeDevices = {
        type: 'subscibeDevices',
        sessionKey?: SessionKey
    }
    export type SubscribeUsers = {
        type: 'subscibeUsers',
        sessionKey?: SessionKey
    }
    export type AliveAck = {
        type: 'alive',
        sessionKey?: SessionKey
    }
    type RequestTypes = RequestLoginInfo | RequestLogin | RequestServerInfo | RequestLogout | RequestSessionReconnect | SubscribeDevices | SubscribeUsers;
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
    export type ResponseSesssionExists = {
        value: boolean
    }
    export type ResponseSubscribeDevices = {
        result: 'ok',
        devices: string[]
    } | {
        result: 'session not found'
    }
    export type ResponseSubscribeUsers = {
        result: 'ok',
        users: { nickname: string, location: string, uid: number }[]
    } | {
        result: 'session not found'
    }
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
        user: { nickname: string, location: string, uid: number }
    } | {
        kind: 'removed',
        uid: number
    })
    type HeartbeatTypes = HeartbeatDevices | HeartbeatUsers
    export type Heartbeat = Exclude<HeartbeatTypes, {id: number}>
};