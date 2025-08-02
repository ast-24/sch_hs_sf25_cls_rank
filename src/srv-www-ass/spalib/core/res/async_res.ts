import { SpaResCI } from "./res.d";
import type { SpaAsyncResCI, SpaAsyncResFactoryCI } from "./async_res.d";
import { Igniter_ListenerT, IgniterCI, IgniterFactoryCI } from "../igniter/igniter.d";
import { CxlCtxCI } from "../cxlctx/cxlctx.d";

export type SpaAsyncResC_VialT = {
    igniterFactory: IgniterFactoryCI,
}

export class SpaAsyncResC<RetT> implements SpaAsyncResCI<RetT> {
    private readonly _vial: SpaAsyncResC_VialT;

    private _res: SpaResCI<RetT> | null = null;
    private _onFinish: IgniterCI<SpaResCI<RetT>, void>;

    constructor(vial: SpaAsyncResC_VialT) {
        this._vial = vial;
        this._onFinish = this._vial.igniterFactory.create<SpaResCI<RetT>, void>();
    }

    regOnFinish(callback: Igniter_ListenerT<SpaResCI<RetT>, void>): void {
        this._onFinish.reg(callback);
    }

    isFinished(): boolean {
        return this._res !== null;
    }

    get res(): SpaResCI<RetT> | null {
        return this._res;
    }

    async setRes(
        oprCxlCtx: CxlCtxCI | null,
        res: SpaResCI<RetT>
    ): Promise<void> {
        if (this._res !== null) {
            throw new Error("Result already set");
        }
        this._res = res;
        if (this._onFinish) {
            await this._onFinish.ignite(oprCxlCtx, res);
        }
    }
}

export class SpaAsyncResFactoryC implements SpaAsyncResFactoryCI {
    private _vial: SpaAsyncResC_VialT;

    constructor(vial: SpaAsyncResC_VialT) {
        this._vial = vial;
    }

    create<RetT>() {
        const inst = new SpaAsyncResC<RetT>(this._vial);
        return {
            this: inst,
            setResFn: async (oprCxlCtx: CxlCtxCI | null, res: SpaResCI<RetT>) => {
                await inst.setRes(oprCxlCtx, res);
            }
        };
    }
};
