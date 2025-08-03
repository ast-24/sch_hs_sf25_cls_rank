import { IgniterC } from "./igniter";
import { SpaAsyncResC, SpaAsyncResFactoryC } from "../res/async_res";
import { SpaResFactoryC } from "../res/res";
import { SpaError, SpaError_KindsE } from "../../../spalib";
import { SpaErrorFactoryC } from "../res/error";
import type { Igniter_ListenerT } from "./igniter.d";
import type { CxlCtxCI, CxlCtx_CancelResT } from "../cxlctx/cxlctx.d";
import { yieldThread } from "../utils";

type CxlCtxC_VialT = {
    spaResFactory: SpaResFactoryC,
    spaAsyncResFactory: SpaAsyncResFactoryC,
    spaErrorFactory: SpaErrorFactoryC,
};

export class CxlCtxC implements CxlCtxCI {
    private readonly _vial: CxlCtxC_VialT;
    private _parent: CxlCtxC | null;
    private _children: Set<CxlCtxC> = new Set();
    private _onCancel: IgniterC<void, void>;
    private _canceled: boolean = false;
    private _cancelAsyncRes: SpaAsyncResC<CxlCtx_CancelResT> | null = null;
    private _deadlineTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(vial: CxlCtxC_VialT, parent: CxlCtxC | null = null) {
        this._vial = vial;
        this._parent = parent;
        this._onCancel = new IgniterC<void, void>({
            spaResFactory: this._vial.spaResFactory,
            spaErrorFactory: this._vial.spaErrorFactory
        });
    }

    createChild(): CxlCtxCI {
        const inst = new CxlCtxC(this._vial, this);
        this._children.add(inst);
        return inst;
    }

    regOnCancel(callback: Igniter_ListenerT<void, void>): CxlCtxCI {
        this._onCancel.reg(callback);
        return this;
    }

    deregOnCancel(callback: Igniter_ListenerT<void, void>): CxlCtxCI {
        this._onCancel.dereg(callback);
        return this;
    }

    async cancel(oprCxlCtx: CxlCtxCI | null): Promise<{ res: CxlCtx_CancelResT }> {
        if (this._canceled) {
            if (this._cancelAsyncRes && this._cancelAsyncRes.res) {
                const r = this._cancelAsyncRes.res.getData();
                if (r) return { res: r };
            }
            return { res: { igniterRes: [], childIgnitersRes: [] } };
        }
        this._canceled = true;
        if (this._deadlineTimer) {
            clearTimeout(this._deadlineTimer);
            this._deadlineTimer = null;
        }
        const childIgnitersRes = (await Promise.all(
            Array.from(this._children).map(child => child.cancel(oprCxlCtx))
        )).map(cres => cres.res);
        const igniterRes = await this._onCancel.ignite(oprCxlCtx);
        const res: CxlCtx_CancelResT = {
            igniterRes: igniterRes,
            childIgnitersRes: childIgnitersRes
        };
        if (!this._cancelAsyncRes) {
            const { this: asyncRes, setResFn } = this._vial.spaAsyncResFactory.create<CxlCtx_CancelResT>();
            this._cancelAsyncRes = asyncRes;
            await setResFn(oprCxlCtx, this._vial.spaResFactory.create<CxlCtx_CancelResT>({ t: 'ok', v: res }));
        }
        return { res };
    }

    async setDeadline(oprCxlCtx: CxlCtxCI | null, deadlineBeforeMs: number): Promise<{ res: SpaAsyncResC<CxlCtx_CancelResT> }> {
        if (this._canceled) {
            throw new SpaError(SpaError_KindsE.Canceled, 'キャンセル済み');
        }
        if (this._deadlineTimer) {
            clearTimeout(this._deadlineTimer);
        }
        const { this: asyncRes, setResFn } = this._vial.spaAsyncResFactory.create<CxlCtx_CancelResT>();
        this._deadlineTimer = setTimeout(async () => {
            try {
                const cres = await this.cancel(oprCxlCtx);
                await setResFn(oprCxlCtx, this._vial.spaResFactory.create<CxlCtx_CancelResT>({ t: 'ok', v: cres.res }));
            } catch (err) {
                await setResFn(oprCxlCtx, this._vial.spaResFactory.create<CxlCtx_CancelResT>({ t: 'err', v: err as any }));
            }
        }, deadlineBeforeMs);
        return { res: asyncRes };
    }

    isCanceled(): boolean {
        return this._canceled;
    }

    throwIfCanceled(): void {
        if (this._canceled) {
            throw new SpaError(SpaError_KindsE.Canceled, 'キャンセルされました');
        }
    }

    async throwIfCanceledAndYieldThread(): Promise<void> {
        this.throwIfCanceled();
        await yieldThread();
    }
}
