import { Device } from "./Device";
import { Reactive } from "./Reactive.js";

export type User = {
    nickname: string,
    UID: number,
    passwordHash?: string,
    allowedDevices: Device[],
    accent: Reactive<string>,
    theme?: string
};

export class UserSession {
    readonly user: User;
    lastActive: number = Date.now();

    constructor ( user: User ) {
        this.user = user;
    }

    isActive: Reactive<boolean> = new Reactive<boolean>( true );
}