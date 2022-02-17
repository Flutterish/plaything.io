import type { Control } from "./Device";
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
        : Req extends API.RequestDeviceInfo['type'] ? API.ResponseDeviceInfo
        : Req extends API.SubscribeUsers['type'] ? API.ResponseSubscribeUsers
        : Req extends API.RequestLoadPreferences['type'] ? API.ResponseLoadPreferences
        : Req extends API.RequestJoinControlRoom['type'] ? API.ResponseJoinControlRoom
        : Req extends API.RequestSavePreferences['type'] ? API.Ack | API.InvalidSession
        : API.Ack
};

export namespace API {
    export type InvalidSession = { result: 'session not found' }
    export type SessionRequest = { sessionKey?: SessionKey }
    export type RequestLoginInfo = {
        type: 'login-information'
    }
    export type RequestServerInfo = {
        type: 'server-information'
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
    export type RequestDeviceInfo = {
        type: 'device-info',
        deviceId: number
    } & SessionRequest
    export type RequestJoinControlRoom = {
        type: 'join-control',
        deviceId: number
    } & SessionRequest
    export type SubscribeDevices = {
        type: 'subscibe-devices'
    } & SessionRequest
    export type SubscribeUsers = {
        type: 'subscibe-users'
    } & SessionRequest
    export type AliveAck = {
        type: 'alive'
    } & SessionRequest

    type RequestTypes = 
        RequestLoginInfo | RequestServerInfo 
        | RequestLogin | RequestLogout | RequestSessionReconnect
        | RequestDeviceInfo | RequestJoinControlRoom
        | SubscribeDevices | SubscribeUsers 
        | RequestSavePreferences | RequestLoadPreferences;

    export type Request = Extract<RequestTypes, {type: string}>
    
    export type MessageMovedPointer = {
        type: 'moved-pointer',
        x: number,
        y: number
    } & SessionRequest
    export type MessageModifiedControl = {
        type: 'modified-control',
        controlId: number,
        state: any
    } & SessionRequest
    type MessageTypes = AliveAck | MessageMovedPointer | MessageModifiedControl
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
    export type ResponseDeviceInfo = ({
        result: 'ok',
        name: string,
        controls: Control.Any[]
    } | {
        result: 'not found'
    }) | InvalidSession
    export type ResponseJoinControlRoom = ({
        result: 'ok'
        users: { uid: number, nickname: string, accent: string, x: number, y: number }[]
    } | {
        result: 'device not found' | 'already in a different room' | 'cant join room'
    }) | InvalidSession
    export type ResponseSubscribeDevices = {
        result: 'ok',
        devices: { name: string, id: number }[]
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

    export type HeartbeatUsers = {
        type: 'heartbeat-users'
    } & ({
        kind: 'added' | 'updated',
        user: { nickname: string, location: string, uid: number, accent: string }
    } | {
        kind: 'removed',
        uid: number
    })
    export type ControlRoomUser = { uid: number, nickname: string, accent: string, x: number, y: number }
    export type HeartbeatControlRoomUpdate = {
        type: 'hearthbeat-control-room'
    } & ({
        kind: 'user-joined' | 'user-updated',
        user: ControlRoomUser,
    } | {
        kind: 'user-left',
        uid: number
    } | {
        kind: 'control-modified',
        controlId: number,
        state: any
    })
    type HeartbeatTypes = HeartbeatUsers | HeartbeatControlRoomUpdate
    export type Heartbeat = Exclude<HeartbeatTypes, {id: number}>
};