import { CxlCtxCI } from "../cxlctx/cxlctx.d";
import { Igniter_ListenerT } from "../igniter/igniter.d";
import { SpaResCI } from "./res.d";

export interface SpaAsyncResCI<RetT> {
    regOnFinish: (callback: Igniter_ListenerT<SpaResCI<RetT>, void>) => void;
    isFinished: () => boolean;
    res: SpaResCI<RetT> | null;
}

export interface SpaAsyncResFactoryCI {
    create<RetT>(): {
        this: SpaAsyncResCI<RetT>
        setResFn: (oprCxlCtx: CxlCtxCI | null, res: SpaResCI<RetT>) => Promise<void>
    };
}