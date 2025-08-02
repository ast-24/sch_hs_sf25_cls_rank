import { SpaErrorFactoryCI } from "../res/error.d";
import { SpaResCI, SpaResFactoryCI } from "../res/res.d";
import { CxlCtxCI } from "../cxlctx/cxlctx.d";
import { Igniter_ListenersCorrectionT, Igniter_ListenerT, IgniterCI, IgniterFactoryCI } from "./igniter.d";

export type IgniterC_VialT = {
    spaResFactory: SpaResFactoryCI
    spaErrorFactory: SpaErrorFactoryCI
}

export class IgniterC<ArgT, RetT> implements IgniterCI<ArgT, RetT> {
    private readonly _vial: IgniterC_VialT;

    private readonly _listeners: Igniter_ListenersCorrectionT<ArgT, RetT> = new Set();

    public constructor(vial: IgniterC_VialT) {
        this._vial = vial;
    }

    public reg(listener: Igniter_ListenerT<ArgT, RetT>): IgniterCI<ArgT, RetT> {
        this._listeners.add(listener);
        return this;
    }

    public dereg(listener: Igniter_ListenerT<ArgT, RetT>): IgniterCI<ArgT, RetT> {
        this._listeners.delete(listener);
        return this;
    }

    public ignite(oprCxlCtx: CxlCtxCI | null, arg: ArgT): Promise<SpaResCI<RetT>[]> {
        return Promise.all(
            Array.from(this._listeners).map(listener => (async () => {
                try {
                    return this._vial.spaResFactory.create<RetT>({
                        t: 'ok',
                        v: await listener(oprCxlCtx, arg)
                    });
                } catch (e) {
                    return this._vial.spaResFactory.create<RetT>({
                        t: 'err',
                        v: this._vial.spaErrorFactory.createFrom(e)
                    });
                }
            })())
        );
    }
}

export class IgniterFactoryC implements IgniterFactoryCI {
    private readonly _vial: IgniterC_VialT;

    constructor(vial: IgniterC_VialT) {
        this._vial = vial;
    }

    create<ArgT, RetT>(): IgniterCI<ArgT, RetT> {
        return new IgniterC<ArgT, RetT>(this._vial);
    }
}