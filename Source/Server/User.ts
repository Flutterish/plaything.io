import { Device } from "./Device";

export type User = {
    nickname: string,
    UID: number,
    passwordHash?: string,
    allowedDevices: Device[]
};

export type UserSession = {
    readonly user: User
};