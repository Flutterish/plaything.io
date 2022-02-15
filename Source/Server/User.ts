import { Device } from "./Device";

export type User = {
    nickname: string,
    passwordHash?: string,
    allowedDevices: Device[]
};

export type UserSession = {
    readonly user: User
};