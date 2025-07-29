/*

app 全体管理
deviceDetector デバイス判定(縦横比)
resourceLoader アセット読み込み
router ルーティング
navigator 遷移管理

domのラッパー？
*/

enum SpaError_LogLevelE {
    Error = 'error',
    Warn = 'warn',
    Info = 'info'
}

class SpaError extends Error {
    kind: SpaError_KindsE;
    cause?: Error;

    constructor(kind: SpaError_KindsE, message?: string, cause?: Error) {
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
}


/*

IgniterC -> 叩かれたら全部を叩く
IgniterWithPriorityC -> 叩かれたら全部をpriority順に叩く
EventIgniterC -> 叩かれたらイベントに紐づいたものを叩く
EventIgniterWithPriorityC -> 叩かれたらイベントに紐づいたものをpriority順に叩く

 */


type IgniterC_ListenerT<ArgT, RetT> = (arg: ArgT) => Promise<RetT>;
type IgniterC_ListenersCorrectionT<ArgT, RetT> = Set<IgniterC_ListenerT<ArgT, RetT>>;

/** 拡張リスナ */
class IgniterC<ArgT = void, RetT = void> {
    private _listeners: IgniterC_ListenersCorrectionT<ArgT, RetT>;

    public constructor() {
        this._listeners = new Set();
    }

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
        ret: RetT[]
    }> {
        const ret: RetT[] = [];
        for (const listener of this._listeners) {
            ret.push(await listener(arg));
        }
        return {
            this: this,
            ret: ret
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
    private _listeners: EventIgniterC_ListenersCorrectionMapT<EventTypeT, ArgT, RetT>;

    public constructor() {
        this._listeners = new Map();
    }

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
        ret: RetT[]
    }> {
        const set = this._listeners.get(event);
        const ret: RetT[] = [];
        if (set) {
            const result = await set.ignite(arg);
            ret.push(...result.ret);
        }
        return {
            this: this,
            ret: ret
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
    private _listeners: IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT>;

    public constructor() {
        this._listeners = new Map();
    }

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
        ret: RetT[]
    }> {
        const ret: RetT[] = [];
        const sortedListeners = Array.from(this._listeners.entries()).sort((a, b) => (a[1].priority || 0) - (b[1].priority || 0));
        for (const [listener] of sortedListeners) {
            ret.push(await listener(arg));
        }
        return {
            this: this,
            ret: ret
        };
    }

    /** リスナのリスト */
    public listeners(): IgniterWithPriorityC_ListenerCorrectionT<ArgT, RetT> {
        return this._listeners;
    }
}

/** 拡張イベントリスナ(+優先順位) */
class EventIgniterWithPriorityC<EventTypeT = string, ArgT = void, RetT = void> {
    private _listeners: Map<EventTypeT, IgniterWithPriorityC<ArgT, RetT>>;

    public constructor() {
        this._listeners = new Map();
    }

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
        ret: RetT[]
    }> {
        const igniter = this._listeners.get(event);
        const ret: RetT[] = [];
        if (igniter) {
            const result = await igniter.ignite(arg);
            ret.push(...result.ret);
        }
        return {
            this: this,
            ret: ret
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

/** キャンセルコンテキスト(状態伝播用) */
class CancelContextC {
    private _onCanceledIgniter: IgniterC<void, void>;
    private _children: Set<CancelContextC>;
    private _isCanceled: boolean;

    private constructor() {
        this._onCanceledIgniter = new IgniterC();
        this._children = new Set();
        this._isCanceled = false;
    }

    public static createRootContext(): CancelContextC {
        return new CancelContextC();
    }

    /** リスナ登録 */
    public reg(listener: IgniterC_ListenerT<void, void>): {
        this: CancelContextC
        deRegFn: () => void
    } {
        // >! 各リスナのエラーは握りつぶさなければ
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
    public async cancel(): Promise<void> {
        if (this._isCanceled) return;
        this._isCanceled = true;
        await this._onCanceledIgniter.ignite();
        for (const child of this._children) {
            // >! ここもエラー抑制
            await child.cancel();
        }
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


type ResourceFetcherC_CachableMethodT = 'GET' | 'HEAD';

type ResourceFetcherC_CacheKeyT = {
    method: ResourceFetcherC_CachableMethodT
    protocol: 'HTTPS' | 'HTTP'
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

    private _cache: ResourceFetcherC_CacheT;

    private constructor() {
        this._cache = new Map();
    }

    public static create(): ResourceFetcherC {
        if (!ResourceFetcherC._instance) {
            ResourceFetcherC._instance = new ResourceFetcherC();
        }
        return ResourceFetcherC._instance;
    }

    /** prefetch */
    public async preFetch(
        fetchCCtx: CancelContextC | null,
        input: RequestInfo | URL,
        init?: RequestInit,
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
            resp = await fetch(input, init);
        } catch (error) {
            throw new SpaError(SpaError_KindsE.NetworkError, 'Network error occurred while fetching resource', error as Error);
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

    /** キャッシュキー化 */
    private intoCacheKey(
        input: RequestInfo | URL,
        init?: RequestInit
    ): string {
        if (input instanceof Request) {
            const url = new URL(input.url);
            const key: ResourceFetcherC_CacheKeyT = {
                method: input.method.toUpperCase() as ResourceFetcherC_CachableMethodT,
                protocol: url.protocol.replace(/:$/, '').toUpperCase() as 'HTTPS' | 'HTTP',
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
                method: (init?.method?.toUpperCase?.() || 'GET') as ResourceFetcherC_CachableMethodT,
                protocol: url.protocol.replace(/:$/, '').toUpperCase() as 'HTTPS' | 'HTTP',
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

/** アスペクト比監視クラス
 *  インスタンスは使いまわし
 */
class AspectWatcherC {
    private static _instance: AspectWatcherC | null = null;

    private _aspectType: AspectWatcherC_AspectTypeE;
    private _onResizeListener: IgniterWithPriorityC<{
        aspectWatcher: AspectWatcherC,
        aspectType: AspectWatcherC_AspectTypeE
    }, void>;
    private _onAspectTypeChangeListener: IgniterWithPriorityC<{
        aspectWatcher: AspectWatcherC,
        aspectType: AspectWatcherC_AspectTypeE
    }, void>;
    private _resizeDebounceTimeoutId: number | null = null;
    private readonly _resizeDebounceDelayMs: number = 100;

    private constructor() {
        this._aspectType = AspectWatcherC.detectAspectType();
        this._onResizeListener = new IgniterWithPriorityC();
        this._onAspectTypeChangeListener = new IgniterWithPriorityC();

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
            await this._onAspectTypeChangeListener.ignite({
                aspectWatcher: this,
                aspectType: this._aspectType
            });
        }
        await this._onResizeListener.ignite({
            aspectWatcher: this,
            aspectType: this._aspectType
        });
    }

    // >! ハンドラ登録(列挙型の優先順位付)とか実装
    // エラー起きないようにラップも
}


class AssetLoaderC {

}


class Router {

}

class SpaNavigator {

}

class SpaManager {

}