import { SpaErrorCI } from "./error.d";
import { SpaResCI, SpaResFactoryCI } from "./res.d";

export class SpaResC<OkT> implements SpaResCI<OkT> {
    private _data: OkT | null = null;
    private _error: SpaErrorCI | null = null;

    constructor(res: { t: 'ok', v: OkT } | { t: 'err', v: SpaErrorCI }) {
        if (res.t === 'ok') {
            this._data = res.v;
        } else {
            this._error = res.v;
        }
    }

    isOk(): boolean {
        return this._data !== null;
    }

    isError(): boolean {
        return this._error !== null;
    }

    getData(): OkT | null {
        return this._data;
    }

    getError(): SpaErrorCI | null {
        return this._error;
    }
}

export class SpaResFactoryC implements SpaResFactoryCI {
    create<OkT>(res: { t: 'ok', v: OkT } | { t: 'err', v: SpaErrorCI }): SpaResCI<OkT> {
        return new SpaResC(res);
    }
}