/*

app 全体管理
router ルーティング
navigator 遷移管理

*/

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
}


type IgniterC_ListenerT<ArgT, RetT> = (arg: ArgT) => Promise<RetT>;
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
    public async ignite(arg: ArgT): Promise<{
        this: IgniterC<ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        for (const listener of this._listeners) {
            try {
                res.push({ type: 'ok', ret: await listener(arg) });
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
    public async ignite(event: EventTypeT, arg: ArgT): Promise<{
        this: EventIgniterC<EventTypeT, ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const set = this._listeners.get(event);
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        if (set) {
            const result = await set.ignite(arg);
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

    /** イベントリスナのリスト */
    public listeners(): EventIgniterC_ListenersCorrectionMapT<EventTypeT, ArgT, RetT> {
        return this._listeners;
    }

    /** リスナのリスト */
    public listenersByEvent(event: EventTypeT): IgniterC_ListenersCorrectionT<ArgT, RetT> {
        return this._listeners.get(event)?.listeners() || new Set();
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
    public async ignite(arg: ArgT): Promise<{
        this: IgniterWithPriorityC<ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        const sortedListeners = Array.from(this._listeners.entries()).sort((a, b) => (a[1].priority || 0) - (b[1].priority || 0));
        for (const [listener] of sortedListeners) {
            try {
                const result = await listener(arg);
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
    public async ignite(event: EventTypeT, arg: ArgT): Promise<{
        this: EventIgniterWithPriorityC<EventTypeT, ArgT, RetT>
        res: IgniterC_IgniteResultT<RetT>[]
    }> {
        const igniter = this._listeners.get(event);
        const res: IgniterC_IgniteResultT<RetT>[] = [];
        if (igniter) {
            const result = await igniter.ignite(arg);
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

    /** イベントリスナのリスト */
    public listeners(): Map<EventTypeT, IgniterWithPriorityC<ArgT, RetT>> {
        return this._listeners;
    }

    /** リスナのリスト */
    public listenersByEvent(event: EventTypeT): IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT> {
        return this._listeners.get(event)?.listeners() || new Map();
    }
}

type CancelContextC_ResultT = {
    igniterRes: IgniterC_IgniteResultT<void>[],
    childsRes: CancelContextC_ResultT[]
}

/** キャンセルコンテキスト(状態伝播用) */
class CancelContextC {
    private readonly _onCanceledIgniter: IgniterC<void, void> = new IgniterC();
    private readonly _children: Set<CancelContextC> = new Set();
    private _isCanceled: boolean = false;

    private constructor() { }

    public static createRootContext(): CancelContextC {
        return new CancelContextC();
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
    public async cancel(): Promise<{
        this: CancelContextC
        res: CancelContextC_ResultT
    }> {
        let res: CancelContextC_ResultT = {
            igniterRes: [],
            childsRes: []
        };
        if (!this._isCanceled) {
            this._isCanceled = true;
            res.igniterRes = (await this._onCanceledIgniter.ignite()).res;
            for (const child of this._children) {
                res.childsRes.push((await child.cancel()).res);
            }
        }
        return {
            this: this,
            res: res
        };
    }

    /** リスナのリスト */
    public listeners(): Array<IgniterC_ListenerT<void, void>> {
        return Array.from(this._onCanceledIgniter.listeners());
    }

    /** 子供作成（キャンセル状態共有） */
    public createChild(): CancelContextC {
        const child = new CancelContextC();
        child._isCanceled = this._isCanceled;
        return child;
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
    private static _instance: ResourceFetcherC | null = null;

    private readonly _cache: ResourceFetcherC_CacheT = new Map();

    private constructor() { }

    public static create(): ResourceFetcherC {
        if (!ResourceFetcherC._instance) {
            ResourceFetcherC._instance = new ResourceFetcherC();
        }
        return ResourceFetcherC._instance;
    }

    /** 取得
     *  respのbodyは読み取り不可なので注意
     */
    public async fetch(
        fetchCCtx: CancelContextC | null,
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

        await coreHelpersC.cancelCheckAndYieldThread(fetchCCtx);

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

        await coreHelpersC.cancelCheckAndYieldThread(fetchCCtx);

        let resp: Response;
        try {
            const fetchAbortController = new AbortController();
            const fetchAbortSignal = fetchAbortController.signal;
            const fetchCCtxAbortRegRet = fetchCCtx?.reg(async () => { fetchAbortController.abort(); });
            resp = await fetch(input, { signal: fetchAbortSignal, ...init });
            if (fetchCCtxAbortRegRet) {
                fetchCCtxAbortRegRet.deRegFn();
            }
        } catch (error) {
            if (fetchCCtx?.isCanceled()) {
                throw new SpaError(SpaError_KindsE.Canceled, 'Fetch operation was canceled');
            }
            const url = (input instanceof Request ? input.url : (input instanceof URL ? input.href : String(input)));
            throw new SpaError(SpaError_KindsE.NetworkError, `Network error occurred while fetching resource: ${url}`, error as Error);
        }

        // ステータスコードの解釈はクライアントアプリケーション側に任せる

        await coreHelpersC.cancelCheckAndYieldThread(fetchCCtx);

        const body = await resp.blob();

        await coreHelpersC.cancelCheckAndYieldThread(fetchCCtx);

        if (isCachableMethod) {
            const cacheKey = this.intoCacheKey(input, init);
            const cacheValue: ResourceFetcherC_CacheValueT = {
                fetchedAt: new Date(),
                resp: resp.clone(),
                body: body
            };
            this._cache.set(cacheKey, cacheValue);
        }

        await coreHelpersC.cancelCheckAndYieldThread(fetchCCtx);

        return {
            resp: resp,
            body: body,
            isCache: false
        };
    }

    /** prefetch */
    public async preFetch(
        fetchCCtx: CancelContextC | null,
        input: RequestInfo | URL,
        init?: RequestInit,
        allowCacheWindowMs: number = 0,
        onResult?: (succeed: boolean, error?: SpaError) => Promise<void>
    ): Promise<{
        this: ResourceFetcherC
    }> {
        setTimeout(async () => {
            let state: 'succeed' | 'failed' | 'canceled' = 'failed';
            let error: SpaError | undefined;
            try {
                await this.fetch(fetchCCtx, input, init, 0);
                state = 'succeed';
            } catch (e) {
                // 無視(プリフェッチ失敗は非致命的)
                if (e instanceof SpaError) {
                    error = e;
                    if (error.kind === SpaError_KindsE.Canceled) {
                        state = 'canceled';
                    } else {
                        error.logging(SpaError_LogLevelE.Warn, 'Prefetch failed');
                        state = 'failed';
                    }
                } else {
                    error = new SpaError(SpaError_KindsE.Unexpected, 'Unexpected error during prefetch', e as Error);
                    error.logging(SpaError_LogLevelE.Error, 'Prefetch failed');
                    state = 'failed';
                }
            } finally {
                if (state === 'succeed' || state === 'failed') {
                    await onResult?.(state === 'succeed', error);
                }
            }
        }, 0);
        return {
            this: this
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

/** アスペクト比監視クラス
 *  インスタンスは使いまわし
 */
class AspectWatcherC {
    private static _instance: AspectWatcherC | null = null;

    private _aspectType: AspectWatcherC_AspectTypeE = AspectWatcherC.detectAspectType();
    private readonly _onResizeListener: IgniterWithPriorityC<AspectWatcherC_ListenerArgT, void> = new IgniterWithPriorityC();
    private readonly _onAspectTypeChangeListener: IgniterWithPriorityC<AspectWatcherC_ListenerArgT, void> = new IgniterWithPriorityC();
    private _resizeDebounceTimeoutId: number | null = null;
    private readonly _resizeDebounceDelayMs: number = 100;

    private constructor() {
        window.addEventListener('resize', () => { this.scheduleResize(); });
    }

    public static create(): AspectWatcherC {
        if (AspectWatcherC._instance === null) {
            AspectWatcherC._instance = new AspectWatcherC();
        }
        return AspectWatcherC._instance;
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

    /** リサイズのデバウンス機構 */
    private scheduleResize(): void {
        if (this._resizeDebounceTimeoutId !== null) {
            clearTimeout(this._resizeDebounceTimeoutId);
        }
        this._resizeDebounceTimeoutId = setTimeout(() => {
            this._resizeDebounceTimeoutId = null;
            this.onResize();
        }, this._resizeDebounceDelayMs);
    }

    /** リサイズ処理 */
    private async onResize(): Promise<void> {
        const newAspectType = AspectWatcherC.detectAspectType();
        if (this._aspectType !== newAspectType) {
            this._aspectType = newAspectType;
            const result = await this._onAspectTypeChangeListener.ignite({
                aspectWatcher: this,
                aspectType: this._aspectType
            });
            result.res.forEach(r => {
                if (r.type === 'error') {
                    coreHelpersC.loggingError(r.err, 'on aspect type change listener failed');
                }
            });
        }
        const result = await this._onResizeListener.ignite({
            aspectWatcher: this,
            aspectType: this._aspectType
        });
        result.res.forEach(r => {
            if (r.type === 'error') {
                coreHelpersC.loggingError(r.err, 'on resize listener failed');
            }
        });
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


/** DOMの簡易ラッパー */
class SpaVDOM {
    private _pDOM: HTMLElement;

    public constructor(pDOM: HTMLElement) {
        this._pDOM = pDOM;
    }

    public get pDOM(): HTMLElement {
        return this._pDOM;
    }

    public set pDOM(value: HTMLElement) {
        this._pDOM = value;
    }

    // あとで拡張(継承) innerHTML, appendChild, querySelector など
}


type AssetLoaderC_FetchOptionsT = {
    query?: Array<[string, string]>,
    headers?: Record<string, string>,
}

/** アセットの取得と適用を行う */
class AssetLoaderC {
    private readonly _fetcher: ResourceFetcherC = ResourceFetcherC.create();
    private readonly _aspectWatcher: AspectWatcherC = AspectWatcherC.create();

    private readonly _baseUrl: string;
    private readonly _vDOM: SpaVDOM;

    public constructor(baseUrl: string, vDOM: SpaVDOM) {
        this._baseUrl = baseUrl.replace(/\/*$/, ''); // 最後のスラッシュを削除
        this._vDOM = vDOM;
    }

    /** URL構築 */
    private buildUrl(assetPath: string): URL {
        const cleanPath = assetPath.replace(/^\/*/, ''); // 先頭のスラッシュを削除
        return new URL(`${this._baseUrl}/${cleanPath}`);
    }

    /** アセット取得 */
    public async fetchAsset(
        fetchCCtx: CancelContextC | null,
        assetPath: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs: number = 60 * 60 * 1000 // デフォルトは1時間
    ): Promise<string> {
        const cleanAssetPath = this.buildUrl(assetPath);
        options?.query?.forEach(([k, v]) => cleanAssetPath.searchParams.append(k, v));
        const fetchOptions: RequestInit = {
            headers: options?.headers// >! 型不整合かも
        }

        const res = await this._fetcher.fetch(fetchCCtx, cleanAssetPath, fetchOptions, allowCacheWindowMs);

        // >! ステータスコード(4xxと5xxはエラー、それ以外の!okはunexpected)

        await coreHelpersC.cancelCheckAndYieldThread(fetchCCtx);

        try {
            return await res.body.text();
        } catch (e) {
            // >! バグ(期待してたフォーマットじゃない=不整合)
            throw e
        }
    }

    /** プリフェッチ（キャッシュなし） */
    public async preFetchAsset(
        fetchCCtx: CancelContextC | null,
        path: string,
        options?: AssetLoaderC_FetchOptionsT,
        allowCacheWindowMs: number = 0,
    ): Promise<{
        this: AssetLoaderC
    }> {
        // >! こっちにもアセット取得と同じ(ただし前半だけ)処理
        await this._fetcher.preFetch(fetchCCtx, path, options, allowCacheWindowMs);
        return {
            this: this
        };
    }

    // 拡張子でURL構築
    // HTMLを読み込み&適用
    // CSSを読み込み&適用
    // デバイス検出してURL構築
    // HTMLをデバイスごとに読み込み適用
    // CSSをデバイスごとに読み込み適用
}


class Router {

}

class SpaNavigator {

}

class SpaManager {

}