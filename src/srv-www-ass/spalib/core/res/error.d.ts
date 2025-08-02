export interface SpaErrorCI extends Error {
    name: string;
    kind: SpaError_KindsE;
    message: string;
    stack?: string;
    cause?: Error;

    toString(title?: string, level?: SpaError_LevelE,): string;
    logging(title?: string, level?: SpaError_LevelE): void;
}

export interface SpaErrorFactoryCI {
    create(kind: SpaError_KindsE, message: string, cause?: Error): SpaErrorCI;
    createFrom(error: any): SpaErrorCI;
}

export enum SpaError_KindsE {
    Unexpected = 'Unexpected',     // 原因不明(外部エラー等)
    Canceled = 'Canceled',         // コンテキストで処理中にキャンセル
    Network = 'Network',           // ネットワーク障害
    ClPgBug = 'ClPgBug',           // クライアント側プログラムのバグ
    SrvFatal = 'SrvFatal',         // サーバ側の致命的なエラー
    SrvTransient = 'SrvTransient', // サーバ側の一時的なエラー
    InvalidOpr = 'InvalidOpr',     // 不正なユーザ操作
}

export enum SpaError_LevelE {
    Error = 'Error',
    Warn = 'Warn',
    Info = 'Info',
}