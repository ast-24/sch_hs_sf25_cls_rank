enum SpaError_LogLevelE {
    Error = 'error',
    Warn = 'warn',
    Info = 'info'
}

class SpaError extends Error {
    public readonly kind: SpaError_KindsE;
    public readonly cause?: Error;

    public constructor(kind: SpaError_KindsE, message?: string, cause?: Error) {
        super(message, { cause: cause });
        this.name = 'SpaError';
        this.kind = kind;
        this.cause = cause;
    }

    public toString(title?: string): string {
        return `[ERROR] ${title ? `${title}: ` : ''}${this.name}: ${this.kind}: ${this.message}: ${this.stack} (caused by: ${this.cause ? `${this.cause.name}: ${this.cause.message}: ${this.cause.stack}` : 'unknown'})`;
    }

    public logging(level?: SpaError_LogLevelE, title?: string): void {
        switch (level) {
            case SpaError_LogLevelE.Error:
                console.error(this.toString(title));
                break;
            case SpaError_LogLevelE.Warn:
                console.warn(this.toString(title));
                break;
            case SpaError_LogLevelE.Info:
                console.info(this.toString(title));
                break;
        }
    }
}

enum SpaError_KindsE {
    Unexpected = 'unexpected',      // 原因不明
    Canceled = 'canceled',          // キャンセル
    NetworkError = 'network_error', // ネットワーク障害
    Bug = 'bug',                    // クライアント側バグ
    ServerError = 'server_error',   // サーバー側エラー
}


/** 汎用ヘルパー */
class coreHelpersC {
    public static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public static async yieldThread(): Promise<void> {
        await coreHelpersC.delay(0);
    }

    public static async cancelCheckAndYieldThread(
        cctx: CancelContextC | null
    ): Promise<void> {
        cctx?.throwIfCanceled();
        await coreHelpersC.yieldThread();
    }

    public static intoUnexpectedError(msg: string, err: Error): SpaError {
        if (err instanceof SpaError) {
            return err;
        }
        return new SpaError(SpaError_KindsE.Unexpected, msg, err);
    }

    public static loggingError(err: Error, title: string) {
        if (err instanceof SpaError) {
            err.logging(SpaError_LogLevelE.Error, title);
        } else {
            const spaErr = coreHelpersC.intoUnexpectedError('Unexpected error occurred', err);
            spaErr.logging(SpaError_LogLevelE.Error, title);
        }
    }

    public static IgniterResultloggingError<RetT>(
        igniterRes: IgniterC_IgniteResultT<RetT>[],
        title: string
    ): void {
        igniterRes.forEach(r => {
            if (r.type === 'error') {
                coreHelpersC.loggingError(r.err, title);
            }
        });
    }
}


type AsyncResultC_ResultT<RetT> = { type: 'ok', ret: RetT } | { type: 'error', err: Error };

type AsyncResultC_OnFinishListenerT<RetT> = (result: AsyncResultC_ResultT<RetT>) => Promise<void>;

/** 非同期処理の結果取得用クラス
 *  キャンセルされた場合などは結果が返ってこないので注意
 */
class AsyncResultC<RetT> {
    private _result: AsyncResultC_ResultT<RetT> | null = null;

    private _onFinishListener: AsyncResultC_OnFinishListenerT<RetT> | null = null;

    private constructor() { }

    public static create<RetT>(): {
        this: AsyncResultC<RetT>,
        setResult: (result: AsyncResultC_ResultT<RetT>) => Promise<void>,
    } {
        const instance = new AsyncResultC<RetT>();
        return {
            this: instance,
            setResult: async (result: AsyncResultC_ResultT<RetT>) => instance.setResult(result)
        };
    }

    private async setResult(result: AsyncResultC_ResultT<RetT>): Promise<void> {
        if (this._result !== null) {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is already set');
        }
        this._result = result;
        await this._onFinishListener?.(result);
    }

    // 以下は関数を叩いた側用のメソッド

    public regOnFinishListener(
        listener: AsyncResultC_OnFinishListenerT<RetT>
    ): {
        this: AsyncResultC<RetT>
    } {
        if (this._onFinishListener !== null) {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC OnFinishListener is already set');
        }
        this._onFinishListener = async (result: AsyncResultC_ResultT<RetT>) => {
            try {
                await listener(result);
                this._onFinishListener = null;
            } catch (err) {
                coreHelpersC.loggingError(err, 'AsyncResultC OnFinishListener failed');
            }
        };
        return {
            this: this,
        };
    }

    public isFinished(): boolean {
        return !!this._result;
    }

    public getResult(): AsyncResultC_ResultT<RetT> {
        if (this._result === null) {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is not set yet');
        }
        return this._result;
    }

    public isSuccess(): boolean {
        if (this._result === null) {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is not set yet');
        }
        return this._result?.type === 'ok';
    }

    public getReturnValue(): RetT {
        if (this._result === null) {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is not set yet');
        }
        if (this._result.type !== 'ok') {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is error');
        }
        return this._result.ret;
    }

    public getError(): Error {
        if (this._result === null) {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is not set yet');
        }
        if (this._result.type !== 'error') {
            throw new SpaError(SpaError_KindsE.Bug, 'AsyncResultC result is not error');
        }
        return this._result.err;
    }
}


type IgniterC_ListenerT<ArgT, RetT> = (oprCCtx: CancelContextC | null, arg: ArgT) => Promise<RetT>;
type IgniterC_ListenersCorrectionT<ArgT, RetT> = Set<IgniterC_ListenerT<ArgT, RetT>>;
type IgniterC_IgniteResultT<RetT> = { type: 'ok', ret: RetT } | { type: 'error', err: Error };

/** 拡張リスナ */
class IgniterC<ArgT = void, RetT = void> {
    private readonly _listeners: IgniterC_ListenersCorrectionT<ArgT, RetT> = new Set();

    public constructor() { }

    /** リスナ登録 */
    public reg(listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: IgniterC<ArgT, RetT>
        deRegFn: () => void
    } {
        this._listeners.add(listener);
        return {
            this: this,
            deRegFn: () => this.deReg(listener)
        };
    }

    /** リスナ登録解除 */
    public deReg(listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: IgniterC<ArgT, RetT>
    } {
        this._listeners.delete(listener);
        return {
            this: this,
        };
    }

    /** イベント発火 */
    public async ignite(
        oprCCtx: CancelContextC | null,
        arg: ArgT
    ): Promise<{
        this: IgniterC<ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        for (const listener of this._listeners) {
            await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

            try {
                res.push({ type: 'ok', ret: await listener(oprCCtx, arg) });
            } catch (err) {
                res.push({ type: 'error', err: err });
            }
        }
        return {
            this: this,
            res: res
        };
    }

    /** リスナのリスト */
    public listeners(): IgniterC_ListenersCorrectionT<ArgT, RetT> {
        return this._listeners;
    }

    /** リスナのクリア */
    public clear(): {
        this: IgniterC<ArgT, RetT>
    } {
        this._listeners.clear();
        return {
            this: this,
        };
    }
}

type EventIgniterC_ListenersCorrectionMapT<EventTypeT, ArgT, RetT> = Map<EventTypeT, IgniterC<ArgT, RetT>>;

/** 拡張イベントリスナ */
class EventIgniterC<EventTypeT = string, ArgT = void, RetT = void> {
    private readonly _listeners: EventIgniterC_ListenersCorrectionMapT<EventTypeT, ArgT, RetT> = new Map();

    public constructor() { }

    /** リスナ登録 */
    public reg(event: EventTypeT, listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: EventIgniterC<EventTypeT, ArgT, RetT>
        deRegFn: () => void
    } {
        if (!this._listeners.has(event)) this._listeners.set(event, new IgniterC());
        this._listeners.get(event)!.reg(listener);
        return {
            this: this,
            deRegFn: () => this.deReg(event, listener)
        };
    }

    /** リスナ登録解除 */
    public deReg(event: EventTypeT, listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: EventIgniterC<EventTypeT, ArgT, RetT>
    } {
        const set = this._listeners.get(event);
        if (set) {
            set.deReg(listener);
            if (set.listeners().size === 0) {
                this._listeners.delete(event);
            }
        }
        return {
            this: this,
        };
    }

    /** イベント発火 */
    public async ignite(
        oprCCtx: CancelContextC | null,
        event: EventTypeT,
        arg: ArgT
    ): Promise<{
        this: EventIgniterC<EventTypeT, ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const set = this._listeners.get(event);
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        if (set) {
            const result = await set.ignite(oprCCtx, arg);
            res.push(...result.res);
        }
        return {
            this: this,
            res: res
        };
    }

    /** イベントタイプのリスト */
    public listeningEventTypes(): Array<EventTypeT> {
        return Array.from(this._listeners.keys());
    }

    /** リスナのリスト */
    public listenersByEvent(event: EventTypeT): IgniterC_ListenersCorrectionT<ArgT, RetT> {
        return this._listeners.get(event)?.listeners() || new Set();
    }

    /** イベントリスナのリスト */
    public listeners(): EventIgniterC_ListenersCorrectionMapT<EventTypeT, ArgT, RetT> {
        return this._listeners;
    }

    /** リスナのクリア */
    public clear(): {
        this: EventIgniterC<EventTypeT, ArgT, RetT>
    } {
        this._listeners.clear();
        return {
            this: this,
        };
    }

    /** イベントリスナのクリア */
    public clearByEvent(event: EventTypeT): {
        this: EventIgniterC<EventTypeT, ArgT, RetT>
    } {
        this._listeners.get(event)?.clear();
        return {
            this: this,
        };
    }
}

type IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT> = Map<IgniterC_ListenerT<ArgT, RetT>, { priority?: number; }>;

/** 拡張リスナ(+優先順位) */
class IgniterWithPriorityC<ArgT = void, RetT = void> {
    private readonly _listeners: IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT> = new Map();

    public constructor() { }

    /** リスナ登録 */
    public reg(listener: IgniterC_ListenerT<ArgT, RetT>, priority?: number): {
        this: IgniterWithPriorityC<ArgT, RetT>
        deRegFn: () => void
    } {
        this._listeners.set(listener, { priority });
        return {
            this: this,
            deRegFn: () => this.deReg(listener)
        };
    }

    /** リスナ登録解除 */
    public deReg(listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: IgniterWithPriorityC<ArgT, RetT>
    } {
        this._listeners.delete(listener);
        return {
            this: this,
        };
    }

    /** イベント発火(優先順位順) */
    public async ignite(
        oprCCtx: CancelContextC | null,
        arg: ArgT
    ): Promise<{
        this: IgniterWithPriorityC<ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        const sortedListeners = Array.from(this._listeners.entries()).sort((a, b) => (a[1].priority || 0) - (b[1].priority || 0));

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        for (const [listener] of sortedListeners) {
            await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

            try {
                const result = await listener(oprCCtx, arg);
                res.push({ type: 'ok', ret: result });
            } catch (err) {
                res.push({ type: 'error', err: err });
            }
        }
        return {
            this: this,
            res: res
        };
    }

    /** リスナのリスト */
    public listeners(): IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT> {
        return this._listeners;
    }

    /** リスナのクリア */
    public clear(): {
        this: IgniterWithPriorityC<ArgT, RetT>
    } {
        this._listeners.clear();
        return {
            this: this,
        };
    }
}

/** 拡張イベントリスナ(+優先順位) */
class EventIgniterWithPriorityC<EventTypeT = string, ArgT = void, RetT = void> {
    private readonly _listeners: Map<EventTypeT, IgniterWithPriorityC<ArgT, RetT>> = new Map();

    public constructor() { }

    /** リスナ登録 */
    public reg(event: EventTypeT, listener: IgniterC_ListenerT<ArgT, RetT>, priority?: number): {
        this: EventIgniterWithPriorityC<EventTypeT, ArgT, RetT>
        deRegFn: () => void
    } {
        if (!this._listeners.has(event)) this._listeners.set(event, new IgniterWithPriorityC());
        this._listeners.get(event)!.reg(listener, priority);
        return {
            this: this,
            deRegFn: () => this.deReg(event, listener)
        };
    }

    /** リスナ登録解除 */
    public deReg(event: EventTypeT, listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: EventIgniterWithPriorityC<EventTypeT, ArgT, RetT>
    } {
        const igniter = this._listeners.get(event);
        if (igniter) {
            igniter.deReg(listener);
            if (igniter.listeners().size === 0) {
                this._listeners.delete(event);
            }
        }
        return {
            this: this,
        };
    }

    /** イベント発火(優先順位順) */
    public async ignite(
        oprCCtx: CancelContextC | null,
        event: EventTypeT,
        arg: ArgT
    ): Promise<{
        this: EventIgniterWithPriorityC<EventTypeT, ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const igniter = this._listeners.get(event);
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        if (igniter) {
            const result = await igniter.ignite(oprCCtx, arg);
            res.push(...result.res);
        }
        return {
            this: this,
            res: res
        };
    }

    /** イベントタイプのリスト */
    public listeningEventTypes(): Array<EventTypeT> {
        return Array.from(this._listeners.keys());
    }

    /** リスナのリスト */
    public listenersByEvent(event: EventTypeT): IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT> {
        return this._listeners.get(event)?.listeners() || new Map();
    }

    /** イベントリスナのリスト */
    public listeners(): Map<EventTypeT, IgniterWithPriorityC<ArgT, RetT>> {
        return this._listeners;
    }

    /** リスナのクリア */
    public clear(): {
        this: EventIgniterWithPriorityC<EventTypeT, ArgT, RetT>
    } {
        this._listeners.clear();
        return {
            this: this,
        };
    }

    /** イベントリスナのクリア */
    public clearByEvent(event: EventTypeT): {
        this: EventIgniterWithPriorityC<EventTypeT, ArgT, RetT>
    } {
        this._listeners.get(event)?.clear();
        return {
            this: this,
        };
    }
}


type CancelContextC_ResultT = {
    igniterRes: IgniterC_IgniteResultT<void>[],
    childsRes: CancelContextC_ResultT[]
}

/** キャンセルコンテキスト(状態伝播用) */
class CancelContextC {
    protected readonly _onCanceledIgniter: IgniterC<void, void> = new IgniterC();
    protected readonly _children: Set<CancelContextC> = new Set();
    protected _parent: CancelContextC | null = null;
    protected _isCanceled: boolean = false;

    protected constructor() { }

    public static createRootContext(): CancelContextC {
        return new CancelContextC();
    }

    /** 子供作成（キャンセル状態共有） */
    public createChild(): CancelContextC {
        const child = new CancelContextC();
        child._parent = this;
        this._children.add(child);
        return child;
    }

    /** リスナ登録 */
    public reg(listener: IgniterC_ListenerT<void, void>): {
        this: CancelContextC
        deRegFn: () => void
    } {
        this._onCanceledIgniter.reg(listener);
        return {
            this: this,
            deRegFn: () => this.deReg(listener)
        };
    }

    /** リスナ登録解除 */
    public deReg(listener: IgniterC_ListenerT<void, void>): void {
        this._onCanceledIgniter.deReg(listener);
    }

    /** キャンセル */
    public async cancel(
        oprCCtx: CancelContextC | null
    ): Promise<{
        this: CancelContextC
        res: CancelContextC_ResultT
    }> {
        let res: CancelContextC_ResultT = {
            igniterRes: [],
            childsRes: []
        };
        if (!this._isCanceled) {
            this._isCanceled = true;
            res.igniterRes = (await this._onCanceledIgniter.ignite(oprCCtx)).res;
            for (const child of this._children) {
                res.childsRes.push((await child.cancel(oprCCtx)).res);
            }
            this._onCanceledIgniter.clear();
        }
        return {
            this: this,
            res: res
        };
    }

    /** タイムアウト */
    public setTimeout(
        oprCCtx: CancelContextC | null,
        timeoutBeforeMs: number
    ): {
        this: CancelContextC
        res: AsyncResultC<CancelContextC_ResultT>
    } {
        const asyncResult = AsyncResultC.create<CancelContextC_ResultT>();
        setTimeout(async () => {
            try {
                const cancelRes = await this.cancel(oprCCtx);
                asyncResult.setResult({ type: 'ok', ret: cancelRes.res });
            } catch (err) {
                if (oprCCtx?.isCanceled()) {
                    // 何もしない
                } else {
                    asyncResult.setResult({ type: 'error', err: coreHelpersC.intoUnexpectedError('Timeout error', err as Error) });
                }
            }
        }, timeoutBeforeMs);
        return {
            this: this,
            res: asyncResult.this
        };
    }

    /** 締め切り */
    public setDeadline(
        oprCCtx: CancelContextC | null,
        deadlineAt: Date
    ): {
        this: CancelContextC
        res: AsyncResultC<CancelContextC_ResultT>
    } {
        const timeoutBeforeMs = Math.max(deadlineAt.getTime() - new Date().getTime(), 0);
        return this.setTimeout(oprCCtx, timeoutBeforeMs);
    }

    /** リスナのリスト */
    public listeners(): Array<IgniterC_ListenerT<void, void>> {
        return Array.from(this._onCanceledIgniter.listeners());
    }

    /** キャンセル済みか */
    public isCanceled(): boolean {
        return this._isCanceled;
    }

    /** キャンセル済みなら例外throw */
    public throwIfCanceled(): void {
        if (this._isCanceled) {
            throw new SpaError(SpaError_KindsE.Canceled);
        }
    }
}

/** キャンセルコンテキスト(状態伝播用)(+再開機能) */
class RestartableCancelContextC extends CancelContextC {
    private readonly _onRestartIgniter: IgniterC<void, void> = new IgniterC();

    private constructor() {
        super();
    }

    public static createRootRestartableContext(): RestartableCancelContextC {
        return new RestartableCancelContextC();
    }

    /** 子供作成（キャンセル状態共有） */
    public createRestartableChild(): RestartableCancelContextC {
        const child = new RestartableCancelContextC();
        child._parent = this;
        this._children.add(child);
        return child;
    }

    /** 再開 */
    public async restart(
        oprCCtx: CancelContextC | null
    ): Promise<{
        this: RestartableCancelContextC
        res: CancelContextC_ResultT
    }> {
        if (this._parent?.isCanceled()) {
            throw new SpaError(SpaError_KindsE.Bug, 'Cannot restart a canceled context');
        }
        let res: CancelContextC_ResultT = {
            igniterRes: [],
            childsRes: []
        };
        if (!this._isCanceled) {
            this._isCanceled = false;
            res.igniterRes = (await this._onRestartIgniter.ignite(oprCCtx)).res;
            for (const child of this._children) {
                if (child instanceof RestartableCancelContextC) {
                    res.childsRes.push((await child.restart(oprCCtx)).res);
                }
            }
        }
        return {
            this: this,
            res: res
        };
    }

    /** キャンセル(リスナをクリアしない版) */
    public async cancel(
        oprCCtx: CancelContextC | null
    ): Promise<{
        this: CancelContextC
        res: CancelContextC_ResultT
    }> {
        let res: CancelContextC_ResultT = {
            igniterRes: [],
            childsRes: []
        };
        if (!this._isCanceled) {
            this._isCanceled = true;
            res.igniterRes = (await this._onCanceledIgniter.ignite(oprCCtx)).res;
            for (const child of this._children) {
                res.childsRes.push((await child.cancel(oprCCtx)).res);
            }
            // リスナの削除は行わない
            // this._onCanceledIgniter.clear();
        }
        return {
            this: this,
            res: res
        };
    }

    /** タイムアウト(オーバーライド版Cancelを使用) */
    public setTimeout(
        oprCCtx: CancelContextC | null,
        timeoutBeforeMs: number
    ): {
        this: CancelContextC
        res: AsyncResultC<CancelContextC_ResultT>
    } {
        const asyncResult = AsyncResultC.create<CancelContextC_ResultT>();
        setTimeout(async () => {
            try {
                const cancelRes = await this.cancel(oprCCtx);
                asyncResult.setResult({ type: 'ok', ret: cancelRes.res });
            } catch (err) {
                if (oprCCtx?.isCanceled()) {
                    // 何もしない
                } else {
                    asyncResult.setResult({ type: 'error', err: coreHelpersC.intoUnexpectedError('Timeout error', err as Error) });
                }
            }
        }, timeoutBeforeMs);
        return {
            this: this,
            res: asyncResult.this
        };
    }

    /** 締め切り(オーバーライド版Cancelを使用) */
    public setDeadline(
        oprCCtx: CancelContextC | null,
        deadlineAt: Date
    ): {
        this: CancelContextC
        res: AsyncResultC<CancelContextC_ResultT>
    } {
        const timeoutBeforeMs = Math.max(deadlineAt.getTime() - new Date().getTime(), 0);
        return this.setTimeout(oprCCtx, timeoutBeforeMs);
    }
}


type ResourceFetcherC_CacheKeyT = {
    method: string
    protocol: string
    host: string
    port: number
    path: string
    query: Array<[string, string]>
    headers: Array<[string, string]>
}

type ResourceFetcherC_CacheValueT = {
    fetchedAt: Date
    resp: Response
    body: Blob
};

type ResourceFetcherC_CacheT = Map<string, ResourceFetcherC_CacheValueT>;

/** リソース取得(キャッシュ機能付き)
 *  インスタンスは使いまわし
*/
class ResourceFetcherC {
    private static readonly _instance: ResourceFetcherC = new ResourceFetcherC();

    private readonly _cache: ResourceFetcherC_CacheT = new Map();

    private constructor() { }

    public static create(): ResourceFetcherC {
        return ResourceFetcherC._instance;
    }

    /** 取得
     *  respのbodyは読み取り不可なので注意
     */
    public async fetch(
        oprCCtx: CancelContextC | null,
        input: RequestInfo | URL,
        init?: RequestInit,
        allowCacheWindowMs: number = 0
    ): Promise<{
        resp: Response
        body: Blob
        isCache: boolean
    }> {
        const isCachableMethod: boolean = (() => {
            let method: string | undefined;
            if (input instanceof Request) {
                method = input.method;
            }
            if (input instanceof URL || typeof input === 'string') {
                method = init?.method?.toUpperCase?.() || 'GET';
            }
            return method !== undefined && ['GET', 'HEAD'].includes(method.toUpperCase());
        })();

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        if (isCachableMethod && allowCacheWindowMs) {
            const cacheKey = this.intoCacheKey(input, init);
            const cacheValue = this._cache.get(cacheKey);
            if (cacheValue) {
                const now = Date.now();
                if (now - cacheValue.fetchedAt.getTime() < allowCacheWindowMs) {
                    return {
                        resp: cacheValue.resp,
                        body: cacheValue.body,
                        isCache: true
                    };
                }
                this._cache.delete(cacheKey);
            }
        }

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        let resp: Response;
        try {
            const fetchAbortController = new AbortController();
            const fetchAbortSignal = fetchAbortController.signal;
            const oprCCtxAbortRegRet = oprCCtx?.reg(async () => { fetchAbortController.abort(); });
            resp = await fetch(input, { signal: fetchAbortSignal, ...init });
            oprCCtxAbortRegRet?.deRegFn();
        } catch (error) {
            if (oprCCtx?.isCanceled()) {
                throw new SpaError(SpaError_KindsE.Canceled, 'Fetch operation was canceled');
            }
            const url = (input instanceof Request ? input.url : (input instanceof URL ? input.href : String(input)));
            throw new SpaError(SpaError_KindsE.NetworkError, `Network error occurred while fetching resource: ${url}`, error as Error);
        }

        // ステータスコードの解釈はクライアントアプリケーション側に任せる

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        const body = await resp.blob();

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        if (isCachableMethod) {
            const cacheKey = this.intoCacheKey(input, init);
            const cacheValue: ResourceFetcherC_CacheValueT = {
                fetchedAt: new Date(),
                resp: resp.clone(),
                body: body
            };
            this._cache.set(cacheKey, cacheValue);
        }

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        return {
            resp: resp,
            body: body,
            isCache: false
        };
    }

    /** prefetch */
    public async preFetch(
        oprCCtx: CancelContextC | null,
        input: RequestInfo | URL,
        init?: RequestInit,
        allowCacheWindowMs: number = 0,
    ): Promise<{
        this: ResourceFetcherC
        result: AsyncResultC<void>
    }> {
        const asyncResult = AsyncResultC.create<void>();
        setTimeout(async () => {
            try {
                await this.fetch(oprCCtx, input, init, allowCacheWindowMs);
                await asyncResult.setResult({ type: 'ok', ret: undefined });
            } catch (e) {
                if (e instanceof SpaError && e.kind === SpaError_KindsE.Canceled) {
                    // 何もしない
                } else {
                    await asyncResult.setResult({ type: 'error', err: coreHelpersC.intoUnexpectedError('Prefetch failed', e as Error) });
                }
            }
        }, 0);
        return {
            this: this,
            result: asyncResult.this
        };
    }

    /** キャッシュキー化 */
    private intoCacheKey(
        input: RequestInfo | URL,
        init?: RequestInit
    ): string {
        if (input instanceof Request) {
            const url = new URL(input.url);
            const key: ResourceFetcherC_CacheKeyT = {
                method: input.method.toUpperCase(),
                protocol: url.protocol.toUpperCase(),
                host: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                query: Array
                    .from(new URLSearchParams(url.search).entries())
                    .map(([key, value]) => [key.toUpperCase(), value])
                    .sort((a, b) => a[0].localeCompare(b[0])) as Array<[string, string]>,
                headers: Array
                    .from((input.headers instanceof Headers ? input.headers.entries() : []) as Iterable<[string, string]>)
                    .map(([key, value]) => [key.toUpperCase(), value])
                    .sort((a, b) => a[0].localeCompare(b[0])) as Array<[string, string]>
            };
            return JSON.stringify(key);
        }
        if (input instanceof URL || typeof input === 'string') {
            const url = input instanceof URL ? input : new URL(input);
            const key: ResourceFetcherC_CacheKeyT = {
                method: (init?.method?.toUpperCase?.() || 'GET'),
                protocol: url.protocol.toUpperCase(),
                host: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                query: Array
                    .from(new URLSearchParams(url.search).entries())
                    .map(([key, value]) => [key.toUpperCase(), value])
                    .sort((a, b) => a[0].localeCompare(b[0])) as Array<[string, string]>,
                headers: Array
                    .from((init?.headers ? (init.headers instanceof Headers ? init.headers.entries() : Object.entries(init.headers)) : []) as Iterable<[string, string]>)
                    .map(([key, value]) => [key.toUpperCase(), value])
                    .sort((a, b) => a[0].localeCompare(b[0])) as Array<[string, string]>
            };
            return JSON.stringify(key);
        }
        throw new Error('Unsupported input type');
    }
}


enum AspectWatcherC_AspectTypeE {
    Portrait = 'portrait',
    Landscape = 'landscape'
};

enum AspectWatcherC_EventPriorityE {
    App = 0,
    Page = 1,
    Component = 2,
    Element = 3
}

type AspectWatcherC_ListenerArgT = {
    aspectWatcher: AspectWatcherC,
    aspectType: AspectWatcherC_AspectTypeE
};

type AspectWatcherC_ListenerT = IgniterC_ListenerT<AspectWatcherC_ListenerArgT, void>;

/** アスペクト比監視クラス */
class AspectWatcherC {
    private _aspectType: AspectWatcherC_AspectTypeE = AspectWatcherC.detectAspectType();
    private _resizeOprCCtx: RestartableCancelContextC | null = null;
    private readonly _onResizeListener: IgniterWithPriorityC<AspectWatcherC_ListenerArgT, void> = new IgniterWithPriorityC();
    private readonly _onAspectTypeChangeListener: IgniterWithPriorityC<AspectWatcherC_ListenerArgT, void> = new IgniterWithPriorityC();
    private _resizeDebounceTimeoutId: number | null = null;
    private readonly _resizeDebounceDelayMs: number = 100;

    private constructor(resizeOprCCtx?: RestartableCancelContextC | null) {
        this._resizeOprCCtx = resizeOprCCtx || null;
        window.addEventListener('resize', () => { this.scheduleResize(this._resizeOprCCtx); });
    }

    public static create(): AspectWatcherC {
        return new AspectWatcherC();
    }

    /** ビューポートの高さ/横幅からアスペクトタイプを判定 */
    private static detectAspectType(): AspectWatcherC_AspectTypeE {
        if (window.innerWidth < window.innerHeight) {
            return AspectWatcherC_AspectTypeE.Portrait;
        } else {
            return AspectWatcherC_AspectTypeE.Landscape;
        }
    }

    /** 現在のアスペクトタイプ */
    public getAspectType(): AspectWatcherC_AspectTypeE {
        return this._aspectType;
    }

    /** リサイズリスナ(+デバウンス機構) */
    private scheduleResize(oprCCtx: CancelContextC | null): void {
        if (this._resizeDebounceTimeoutId !== null) {
            clearTimeout(this._resizeDebounceTimeoutId);
        }
        this._resizeDebounceTimeoutId = setTimeout(async () => {
            this._resizeDebounceTimeoutId = null;
            const result = await this.onResize(oprCCtx);
            coreHelpersC.IgniterResultloggingError(result.onResizeListenerRes, 'on resize listener failed');
            coreHelpersC.IgniterResultloggingError(result.onAspectTypeChangeListenerRes, 'on aspect type change listener failed');
        }, this._resizeDebounceDelayMs);
    }

    /** リサイズ処理 */
    private async onResize(oprCCtx: CancelContextC | null): Promise<{
        this: AspectWatcherC
        onAspectTypeChangeListenerRes: IgniterC_IgniteResultT<void>[]
        onResizeListenerRes: IgniterC_IgniteResultT<void>[]
    }> {
        const newAspectType = AspectWatcherC.detectAspectType();
        const ret: {
            this: AspectWatcherC
            onAspectTypeChangeListenerRes: IgniterC_IgniteResultT<void>[]
            onResizeListenerRes: IgniterC_IgniteResultT<void>[]
        } = {
            this: this,
            onAspectTypeChangeListenerRes: [],
            onResizeListenerRes: []
        };
        ret.onResizeListenerRes = (await this._onResizeListener.ignite(oprCCtx, {
            aspectWatcher: this,
            aspectType: this._aspectType
        })).res;
        if (this._aspectType !== newAspectType) {
            this._aspectType = newAspectType;
            ret.onAspectTypeChangeListenerRes = (await this._onAspectTypeChangeListener.ignite(oprCCtx, {
                aspectWatcher: this,
                aspectType: this._aspectType
            })).res;
        }
        return ret;
    }

    /** リサイズハンドラ登録 */
    public regOnResize(listener: AspectWatcherC_ListenerT, priority?: AspectWatcherC_EventPriorityE): {
        this: AspectWatcherC
        deRegFn: () => void
    } {
        this._onResizeListener.reg(listener, priority);
        return {
            this: this,
            deRegFn: () => this.deRegOnResize(listener)
        };
    }

    /** リサイズハンドラ登録解除 */
    public deRegOnResize(listener: AspectWatcherC_ListenerT): {
        this: AspectWatcherC
    } {
        this._onResizeListener.deReg(listener);
        return {
            this: this
        };
    }

    /** アスペクトタイプ変更ハンドラ登録 */
    public regOnAspectTypeChange(listener: AspectWatcherC_ListenerT, priority?: AspectWatcherC_EventPriorityE): {
        this: AspectWatcherC
        deRegFn: () => void
    } {
        this._onAspectTypeChangeListener.reg(listener, priority);
        return {
            this: this,
            deRegFn: () => this.deRegOnAspectTypeChange(listener)
        };
    }

    /** アスペクトタイプ変更ハンドラ登録解除 */
    public deRegOnAspectTypeChange(listener: AspectWatcherC_ListenerT): {
        this: AspectWatcherC
    } {
        this._onAspectTypeChangeListener.deReg(listener);
        return {
            this: this
        };
    }
}


type AssetLoaderC_FetchOptionsT = {
    query?: Array<[string, string]>,
    headers?: Record<string, string>,
}

/** アセットの取得を行う */
class AssetLoaderC {
    private static readonly defaultAllowCacheWindowMs: number = 60 * 60 * 1000; // デフォルトは1時間

    private readonly _fetcher: ResourceFetcherC = ResourceFetcherC.create();
    private readonly _aspectWatcher: AspectWatcherC;

    private readonly _baseUrl: string;

    public constructor(aspectWatcher: AspectWatcherC, baseUrl: string) {
        this._aspectWatcher = aspectWatcher;
        this._baseUrl = baseUrl.replace(/\/*$/, ''); // 最後のスラッシュを削除
    }

    /** フルURL構築 */
    private buildAssetUrl(assetPath: string): URL {
        // assetPathは先頭のスラッシュを削除
        return new URL(`${this._baseUrl}/${assetPath.replace(/^\/*/, '')}`);
    }

    /** パス構築(+拡張子) */
    private buildAssetPathWithExt(assetFilePath: string, ext: string): string {
        // assetFilePathは最後のスラッシュを削除
        return `${assetFilePath.replace(/\/*$/, '')}.${ext}`;
    }

    /** パス名構築(+拡張子+アスペクトタイプ) */
    private buildAssetPathWithExtWithAspectType(assetDirPath: string, ext: string): string {
        // assetDirPathは最後のスラッシュを削除
        return this.buildAssetPathWithExt(`${assetDirPath.replace(/\/$/, '')}/${this._aspectWatcher.getAspectType()}`, ext);
    }

    /** アセット取得 */
    public async fetchAsset(
        oprCCtx: CancelContextC | null,
        assetPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs: number = AssetLoaderC.defaultAllowCacheWindowMs
    ): Promise<string> {
        const cleanAssetPath = this.buildAssetUrl(assetPath);
        options?.query?.forEach(([k, v]) => cleanAssetPath.searchParams.append(k, v));
        const fetchOptions: RequestInit = {
            headers: options?.headers
        }

        const res = await this._fetcher.fetch(oprCCtx, cleanAssetPath, fetchOptions, allowCacheWindowMs);

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        if (!res.resp.ok) {
            if (Math.floor(res.resp.status / 100) === 4) {
                throw new SpaError(SpaError_KindsE.Bug, `Client error while fetching asset: ${assetPath} (status: ${res.resp.status})`);
            }
            if (Math.floor(res.resp.status / 100) === 5) {
                throw new SpaError(SpaError_KindsE.ServerError, `Server error while fetching asset: ${assetPath} (status: ${res.resp.status})`);
            }
            throw new SpaError(SpaError_KindsE.ServerError, `Failed to fetch asset: ${assetPath} (status: ${res.resp.status})`);
        }

        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        try {
            return await res.body.text();
        } catch (e) {
            throw new SpaError(SpaError_KindsE.Bug, `Failed to read asset body as text: ${assetPath}`, e as Error);
        }
    }

    /** アセット取得(HTML) */
    public async fetchHtml(
        oprCCtx: CancelContextC | null,
        assetFilePath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<string> {
        return this.fetchAsset(oprCCtx, this.buildAssetPathWithExt(assetFilePath, 'html'), options, allowCacheWindowMs);
    }

    /** アセット取得(HTML)(+アスペクトタイプ別) */
    public async fetchHtmlWithAspectType(
        oprCCtx: CancelContextC | null,
        assetDirPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<string> {
        return this.fetchAsset(oprCCtx, this.buildAssetPathWithExtWithAspectType(assetDirPath, 'html'), options, allowCacheWindowMs);
    }

    /** アセット取得(CSS) */
    public async fetchCss(
        oprCCtx: CancelContextC | null,
        assetFilePath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<string> {
        return this.fetchAsset(oprCCtx, this.buildAssetPathWithExt(assetFilePath, 'css'), options, allowCacheWindowMs);
    }

    /** アセット取得(CSS)(+アスペクトタイプ別) */
    public async fetchCssWithAspectType(
        oprCCtx: CancelContextC | null,
        assetDirPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<string> {
        return this.fetchAsset(oprCCtx, this.buildAssetPathWithExtWithAspectType(assetDirPath, 'css'), options, allowCacheWindowMs);
    }

    /** プリフェッチ */
    public async preFetchAsset(
        oprCCtx: CancelContextC | null,
        assetPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs: number = 0,
    ): Promise<{
        this: AssetLoaderC
    }> {
        const cleanAssetPath = this.buildAssetUrl(assetPath);
        options?.query?.forEach(([k, v]) => cleanAssetPath.searchParams.append(k, v));
        const fetchOptions: RequestInit = {
            headers: options?.headers
        }

        await this._fetcher.preFetch(oprCCtx, cleanAssetPath, fetchOptions, allowCacheWindowMs);

        return {
            this: this
        };
    }

    /** プリフェッチ(HTML) */
    public async preFetchHtml(
        oprCCtx: CancelContextC | null,
        assetFilePath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: AssetLoaderC
    }> {
        return this.preFetchAsset(oprCCtx, this.buildAssetPathWithExt(assetFilePath, 'html'), options, allowCacheWindowMs);
    }

    /** プリフェッチ(HTML)(+アスペクトタイプ別) */
    public async preFetchHtmlWithAspectType(
        oprCCtx: CancelContextC | null,
        assetDirPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: AssetLoaderC
    }> {
        return this.preFetchAsset(oprCCtx, this.buildAssetPathWithExtWithAspectType(assetDirPath, 'html'), options, allowCacheWindowMs);
    }

    /** プリフェッチ(CSS) */
    public async preFetchCss(
        oprCCtx: CancelContextC | null,
        assetFilePath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: AssetLoaderC
    }> {
        return this.preFetchAsset(oprCCtx, this.buildAssetPathWithExt(assetFilePath, 'css'), options, allowCacheWindowMs);
    }

    /** プリフェッチ(CSS)(+アスペクトタイプ別) */
    public async preFetchCssWithAspectType(
        oprCCtx: CancelContextC | null,
        assetDirPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: AssetLoaderC
    }> {
        return this.preFetchAsset(oprCCtx, this.buildAssetPathWithExtWithAspectType(assetDirPath, 'css'), options, allowCacheWindowMs);
    }
}


type SpaVDomC_ClearResultT = {
    listeners: IgniterC_IgniteResultT<void>[];
    children: SpaVDomC_ClearResultT[];
};

type SpaVDomC_OnClearListenerArgT = {
    vDom: SpaVDomC
};

type SpaVDomC_OnClearListenerT = IgniterC_ListenerT<SpaVDomC_OnClearListenerArgT, void>;

/** DOMの簡易ラッパー
 *  どこかが保持してライフタイムを管理することを想定
 */
class SpaVDomC {
    private readonly _assetLoader: AssetLoaderC;
    private _vDomLifeCCtx: CancelContextC | null;
    private _pDom: HTMLElement | null;

    private readonly _children: Set<SpaVDomC> = new Set();
    private readonly _onClearListeners: IgniterC<SpaVDomC_OnClearListenerArgT, void> = new IgniterC();

    private constructor(assetLoader: AssetLoaderC, vDomLifeCCtx: CancelContextC | null, pDom: HTMLElement) {
        this._assetLoader = assetLoader;
        this._vDomLifeCCtx = vDomLifeCCtx;
        this._pDom = pDom;
        this._vDomLifeCCtx?.reg(async (oprCCtx: CancelContextC | null) => {
            const result = await this.dispose(oprCCtx);
            SpaVDomC.clearResultRecursiveErrorLogging(result.clearResult);
        });
    }

    public static create(
        assetLoader: AssetLoaderC,
        vDomLifeCCtx: CancelContextC | null,
        pDom: HTMLElement
    ): SpaVDomC {
        return new SpaVDomC(assetLoader, vDomLifeCCtx, pDom);
    }

    /** 設定を継承して子要素を作成 */
    public createChild(pDom: HTMLElement): {
        child: SpaVDomC,
        childLifeCCtx: CancelContextC | null
    } {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        const childLifeCCtx = this._vDomLifeCCtx?.createChild() || null;
        const child = new SpaVDomC(this._assetLoader, childLifeCCtx, pDom);
        this._children.add(child);
        return {
            child,
            childLifeCCtx
        };
    }

    public get pDom(): HTMLElement {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        return this._pDom;
    }

    public async dispose(oprCCtx: CancelContextC | null): Promise<{
        this: SpaVDomC
        clearResult: SpaVDomC_ClearResultT
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is already disposed');
        }
        const clearRet = await this.clear(oprCCtx);
        this._pDom = null;
        this._vDomLifeCCtx = null;

        return {
            this: this,
            clearResult: clearRet.clearResult
        };
    }

    public async clear(oprCCtx: CancelContextC | null): Promise<{
        this: SpaVDomC
        clearResult: SpaVDomC_ClearResultT
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }

        const clearResult: SpaVDomC_ClearResultT = {
            listeners: [],
            children: []
        };

        for (const child of this._children) {
            clearResult.children.push((await child.dispose(oprCCtx)).clearResult);
        }
        this._children.clear();

        clearResult.listeners = (await this._onClearListeners.ignite(oprCCtx, { vDom: this })).res;
        this._onClearListeners.clear();

        this._pDom.innerHTML = '';

        return {
            this: this,
            clearResult: clearResult
        };
    }

    public static clearResultRecursiveErrorLogging(
        res: SpaVDomC_ClearResultT,
        errorMessage: string = 'on vDom clear listener failed'
    ): void {
        coreHelpersC.IgniterResultloggingError(res.listeners, errorMessage);
        res.children.forEach(childRes => SpaVDomC.clearResultRecursiveErrorLogging(childRes, errorMessage));
    }

    public regOnClear(listener: SpaVDomC_OnClearListenerT): {
        this: SpaVDomC
        deRegFn: () => void
    } {
        this._onClearListeners.reg(listener);
        return {
            this: this,
            deRegFn: () => this.deRegOnClear(listener)
        };
    }

    public deRegOnClear(listener: SpaVDomC_OnClearListenerT): {
        this: SpaVDomC
    } {
        this._onClearListeners.deReg(listener);
        return {
            this: this
        };
    }

    public async overrideHtml(
        oprCCtx: CancelContextC | null,
        htmlFilePath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: SpaVDomC
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        const html = await this._assetLoader.fetchHtml(oprCCtx, htmlFilePath, options, allowCacheWindowMs);

        await coreHelpersC.cancelCheckAndYieldThread(this._vDomLifeCCtx);
        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        await this.clear(oprCCtx);

        await coreHelpersC.cancelCheckAndYieldThread(this._vDomLifeCCtx);
        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        this._pDom.innerHTML = html;
        return {
            this: this
        };
    }

    public async overrideHtmlWithAspectType(
        oprCCtx: CancelContextC | null,
        htmlDirPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: SpaVDomC
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        const html = await this._assetLoader.fetchHtmlWithAspectType(oprCCtx, htmlDirPath, options, allowCacheWindowMs);

        await coreHelpersC.cancelCheckAndYieldThread(this._vDomLifeCCtx);
        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        await this.clear(oprCCtx);

        await coreHelpersC.cancelCheckAndYieldThread(this._vDomLifeCCtx);
        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        this._pDom.innerHTML = html;
        return {
            this: this
        };
    }

    public async appendCss(
        oprCCtx: CancelContextC | null,
        cssFilePath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: SpaVDomC
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        const cssContent = await this._assetLoader.fetchCss(oprCCtx, cssFilePath, options, allowCacheWindowMs);

        await coreHelpersC.cancelCheckAndYieldThread(this._vDomLifeCCtx);
        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        const styleElement = document.createElement('style');
        styleElement.textContent = cssContent;
        this._pDom.appendChild(styleElement);
        return {
            this: this
        };
    }

    public async appendCssWithAspectType(
        oprCCtx: CancelContextC | null,
        cssDirPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs?: number
    ): Promise<{
        this: SpaVDomC
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        const cssContent = await this._assetLoader.fetchCssWithAspectType(oprCCtx, cssDirPath, options, allowCacheWindowMs);

        await coreHelpersC.cancelCheckAndYieldThread(this._vDomLifeCCtx);
        await coreHelpersC.cancelCheckAndYieldThread(oprCCtx);

        const styleElement = document.createElement('style');
        styleElement.textContent = cssContent;
        this._pDom.appendChild(styleElement);
        return {
            this: this
        };
    }

    public async clearCss(): Promise<{
        this: SpaVDomC
    }> {
        if (!this._pDom) {
            throw new SpaError(SpaError_KindsE.Bug, 'pDom is disposed');
        }
        const styleElements = this._pDom.querySelectorAll('style');
        styleElements.forEach(el => el.remove());
        return {
            this: this
        };
    }
}


class RendererBaseC {

}


class SpaRouterC {

}


class SpaNavigatorC {

}


class SpaManagerC {

}