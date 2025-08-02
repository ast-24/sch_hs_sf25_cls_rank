import { SpaErrorCI } from "./error.d";

export interface SpaResCI<OkT> {
    isOk: () => boolean;
    isError: () => boolean;
    getData: () => OkT | null;
    getError: () => SpaErrorCI | null;
}

export interface SpaResFactoryCI {
    create<OkT>(res: { t: 'ok', v: OkT } | { t: 'err', v: SpaErrorCI }): SpaResCI<OkT>;
}
