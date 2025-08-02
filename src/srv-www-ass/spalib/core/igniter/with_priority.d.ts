// 拡張リスナ(+優先度)

import { SpaResCI } from "../res/res.d";
import { CxlCtxCI } from "../cxlctx/cxlctx.d";
import { Igniter_ListenerT } from "./igniter.d";

export type IgniterWithPriority_ListenersCorrectionT<ArgT, RetT>
    = Map<Igniter_ListenerT<ArgT, RetT>, {
        priority: number;
    }>;

export interface IgniterWithPriorityCI<ArgT, RetT> {
    reg: (priority: number, listener: Igniter_ListenerT<ArgT, RetT>) => IgniterWithPriorityCI<ArgT, RetT>;
    dereg: (listener: Igniter_ListenerT<ArgT, RetT>) => IgniterWithPriorityCI<ArgT, RetT>;
    ignite: (oprCxlCtx: CxlCtxCI | null, arg: ArgT) => Promise<SpaResCI<RetT>[]>;
}

export interface IgniterWithPriorityFactoryCI {
    create<ArgT, RetT>(): IgniterWithPriorityCI<ArgT, RetT>;
}