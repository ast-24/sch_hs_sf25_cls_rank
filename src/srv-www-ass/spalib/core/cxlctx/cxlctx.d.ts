// 実行キャンセル用コンテキスト

import { SpaAsyncResCI } from "../res/async_res.d";
import { SpaResCI } from "../res/res.d";
import { Igniter_ListenerT } from "../igniter/igniter.d";

export type CxlCtx_CancelResT = {
    igniterRes: SpaResCI<void>[]
    childIgnitersRes: CxlCtx_CancelResT[]
}

export interface CxlCtxCI {
    /** 子供作成(キャンセル状態共有) */
    createChild(): CxlCtxCI;

    regOnCancel(callback: Igniter_ListenerT<void, void>): CxlCtxCI;

    deregOnCancel(callback: Igniter_ListenerT<void, void>): CxlCtxCI;

    cancel(oprCxlCtx: CxlCtxCI | null): Promise<{
        res: CxlCtx_CancelResT;
    }>;

    setDeadline(
        oprCxlCtx: CxlCtxCI | null,
        deadlineBeforeMs: number,
    ): Promise<{
        res: SpaAsyncResCI<CxlCtx_CancelResT>;
    }>;

    isCanceled(): boolean;

    throwIfCanceled(): void;

    throwIfCanceledAndYieldThread(): Promise<void>;
}
