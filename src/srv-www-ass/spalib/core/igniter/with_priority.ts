import { SpaErrorFactoryCI } from "../res/error.d";
import { SpaResCI, SpaResFactoryCI } from "../res/res.d";
import { CxlCtxCI } from "../cxlctx/cxlctx.d";
import { Igniter_ListenerT } from "./igniter.d";
import { IgniterWithPriority_ListenersCorrectionT, IgniterWithPriorityCI, IgniterWithPriorityFactoryCI } from "./with_priority.d";

export type IgniterWithPriorityC_VialT = {
    spaResFactory: SpaResFactoryCI
    spaErrorFactory: SpaErrorFactoryCI
}

export class IgniterWithPriorityC<ArgT, RetT> implements IgniterWithPriorityCI<ArgT, RetT> {
    private readonly _vial: IgniterWithPriorityC_VialT;

    private readonly _listeners: IgniterWithPriority_ListenersCorrectionT<ArgT, RetT> = new Map();

    constructor(vial: IgniterWithPriorityC_VialT) {
        this._vial = vial;
    }

    reg(priority: number, listener: Igniter_ListenerT<ArgT, RetT>): IgniterWithPriorityCI<ArgT, RetT> {
        this._listeners.set(listener, { priority });
        return this;
    }

    dereg(listener: Igniter_ListenerT<ArgT, RetT>): IgniterWithPriorityCI<ArgT, RetT> {
        this._listeners.delete(listener);
        return this;
    }

    async ignite(oprCxlCtx: CxlCtxCI | null, arg: ArgT): Promise<SpaResCI<RetT>[]> {
        // 優先順位でグループ化
        const groups = new Map<number, Igniter_ListenerT<ArgT, RetT>[]>();
        for (const [listener, { priority }] of this._listeners) {
            if (!groups.has(priority)) groups.set(priority, []);
            groups.get(priority)!.push(listener);
        }
        // 優先順位の昇順で実行
        const sortedPriorities = Array.from(groups.keys()).sort((a, b) => a - b);
        const results: SpaResCI<RetT>[] = [];
        for (const priority of sortedPriorities) {
            const listeners = groups.get(priority)!;
            // 同じ優先順位は並列実行
            const groupResults = await Promise.all(listeners.map(async listener => {
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
            }));
            results.push(...groupResults);
        }
        return results;
    }
}

export class IgniterWithPriorityFactoryC implements IgniterWithPriorityFactoryCI {
    private readonly _vial: IgniterWithPriorityC_VialT;

    constructor(vial: IgniterWithPriorityC_VialT) {
        this._vial = vial;
    }

    create<ArgT, RetT>(): IgniterWithPriorityCI<ArgT, RetT> {
        return new IgniterWithPriorityC<ArgT, RetT>(this._vial);
    }
}