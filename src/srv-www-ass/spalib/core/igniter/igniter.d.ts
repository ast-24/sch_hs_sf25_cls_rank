// 拡張リスナ

import { SpaResCI } from "../res/res.d";
import { CxlCtxCI } from "../cxlctx/cxlctx.d";

export type Igniter_ListenerT<ArgT, RetT>
    = (oprCCtx: CxlCtxCI | null, arg: ArgT)
        => Promise<RetT>;

export type Igniter_ListenersCorrectionT<ArgT, RetT>
    = Set<Igniter_ListenerT<ArgT, RetT>>;

export interface IgniterCI<ArgT, RetT> {
    reg: (listener: Igniter_ListenerT<ArgT, RetT>) => IgniterCI<ArgT, RetT>;
    dereg: (listener: Igniter_ListenerT<ArgT, RetT>) => IgniterCI<ArgT, RetT>;
    ignite: (oprCxlCtx: CxlCtxCI | null, arg: ArgT) => Promise<SpaResCI<RetT>[]>;
}

export interface IgniterFactoryCI {
    create<ArgT, RetT>(): IgniterCI<ArgT, RetT>;
}