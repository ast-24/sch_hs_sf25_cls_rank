/*

app 全体管理
deviceDetector デバイス判定(縦横比)
resourceLoader アセット読み込み
router ルーティング
navigator 遷移管理

domのラッパー？
*/

class SpaError extends Error {
    // HdSfErrorに近い感じで実装する？
    // あれより緩和して全関数共通の列挙型でいいかも
}


function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


type IgniterC_ListenerT<ArgT, RetT> = (arg: ArgT) => Promise<RetT>;
type IgniterC_ListenersSetT<ArgT, RetT> = Set<IgniterC_ListenerT<ArgT, RetT>>;
type IgniterC_ListenersSetsMapT<EventTypeT, ArgT, RetT> = Map<EventTypeT, IgniterC_ListenersSetT<ArgT, RetT>>;

/** 拡張イベントリスナ */
class IgniterC<EventTypeT = string, ArgT = void, RetT = void> {
    private _listeners: IgniterC_ListenersSetsMapT<EventTypeT, ArgT, RetT>;

    constructor() {
        this._listeners = new Map();
    }

    /** リスナ登録 */
    reg(event: EventTypeT, listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: IgniterC<EventTypeT, ArgT, RetT>
        deRegFn: () => void
    } {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event)!.add(listener);
        return {
            this: this,
            deRegFn: () => this.deReg(event, listener)
        };
    }

    /** リスナ登録解除 */
    deReg(event: EventTypeT, listener: IgniterC_ListenerT<ArgT, RetT>): {
        this: IgniterC<EventTypeT, ArgT, RetT>
    } {
        const set = this._listeners.get(event);
        if (set) {
            set.delete(listener);
            if (set.size === 0) {
                this._listeners.delete(event);
            }
        }
        return {
            this: this,
        };
    }

    /** イベント発火 */
    async ignite(event: EventTypeT, arg: ArgT): Promise<{
        this: IgniterC<EventTypeT, ArgT, RetT>
        ret: RetT[]
    }> {
        const set = this._listeners.get(event);
        const ret: RetT[] = [];
        if (set) {
            for (const listener of set) {
                ret.push(await listener(arg));
            }
        }
        return {
            this: this,
            ret: ret
        };
    }

    /** キーのリスト */
    getEventTypes(): Array<EventTypeT> {
        return Array.from(this._listeners.keys());
    }

    /** リスナのリスト */
    listeners(): IgniterC_ListenersSetsMapT<EventTypeT, ArgT, RetT> {
        return this._listeners;
    }

    /** リスナのリスト(イベントに紐づいたもの) */
    listenersByEvent(event: EventTypeT): IgniterC_ListenersSetT<ArgT, RetT> {
        return this._listeners.get(event) || new Set();
    }
}


type CancelContextC_ListenerT = () => void;

/** キャンセルコンテキスト(状態共有) */
class CancelContextC {
    private _listeners: Set<CancelContextC_ListenerT>;
    private _children: Set<CancelContextC>;
    private _isCanceled: boolean;

    constructor() {
        this._listeners = new Set();
        this._children = new Set();
        this._isCanceled = false;
    }

    /** リスナ登録 */
    reg(listener: CancelContextC_ListenerT): {
        this: CancelContextC
        deRegFn: () => void
    } {
        this._listeners.add(listener);
        return {
            this: this,
            deRegFn: () => this.deReg(listener)
        };
    }

    /** リスナ登録解除 */
    deReg(listener: CancelContextC_ListenerT): void {
        this._listeners.delete(listener);
    }

    /** キャンセル */
    cancel(): void {
        if (this._isCanceled) return;
        this._isCanceled = true;
        for (const listener of this._listeners) {
            listener();
        }
        for (const child of this._children) {
            child.cancel();
        }
    }

    /** リスナのリスト */
    listeners(): Array<CancelContextC_ListenerT> {
        return Array.from(this._listeners);
    }

    /** 子供作成（キャンセル状態共有） */
    createChild(): CancelContextC {
        return new CancelContextC();
    }

    /** キャンセル済みか */
    isCanceled(): boolean {
        return this._isCanceled;
    }

    /** キャンセル済みなら例外throw */
    throwIfCanceled(): void {
        if (this._isCanceled) {
            throw new Error('context canceled');
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

class ResourceFetcherC {
    private _cache: ResourceFetcherC_CacheT;

    constructor() {
        this._cache = new Map();
    }

    /** prefetch */
    async preFetch(
        cctx: CancelContextC,
        input: RequestInfo | URL,
        init?: RequestInit,
        onResult?: (succeed: boolean) => Promise<void>
    ): Promise<{
        this: ResourceFetcherC
    }> {
        setTimeout(async () => {
            let succeed = false;
            try {
                await this.fetch(cctx, input, init, 0);
                succeed = true;
            } catch (e) {
                // 無視(プリフェッチ失敗は非致命的)
                // >! ここでキャンセル由来のエラーか判定したい → カスタムエラー型を用意したほうがいい
            } finally {
                await onResult?.(succeed);
            }
        }, 0);
        return {
            this: this
        };
    }

    /** 取得
     *  respのbodyは読み取り不可なので注意
     */
    async fetch(
        cctx: CancelContextC,
        input: RequestInfo | URL,// Request | string
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

        cctx.throwIfCanceled();
        await delay(0);

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

        cctx.throwIfCanceled();
        await delay(0);

        const resp = await fetch(input, init);
        const body = await resp.blob();

        cctx.throwIfCanceled();
        await delay(0);

        if (isCachableMethod) {
            const cacheKey = this.intoCacheKey(input, init);
            const cacheValue: ResourceFetcherC_CacheValueT = {
                fetchedAt: new Date(),
                resp: resp.clone(),
                body: body
            };
            this._cache.set(cacheKey, cacheValue);
        }

        cctx.throwIfCanceled();
        await delay(0);

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

// 以上実装済
// 以下未実装


class Router {

}

class SpaNavigator {

}

class SpaManager {

}