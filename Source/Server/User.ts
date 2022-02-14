export type User = {
    nickname: string,
    passwordHash: string
};

export type UserSession = {
    readonly nickname: string
};