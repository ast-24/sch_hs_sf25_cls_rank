
import { SpaError, SpaError_KindsE } from '../../../spalib';
import { IgniterC } from '../igniter/igniter';
import type { CxlCtx_CancelResT, CxlCtxCI } from './cxlctx.d';
import { CxlCtxC, CxlCtxC_VialT } from './cxlctx';
import { ResumeCxlCtx_RestartResT, ResumeCxlCtxCI } from './restartable.d';

export class ResumeCxlCtxC extends CxlCtxC implements CxlCtxCI, ResumeCxlCtxCI {
    private _onRestart: IgniterC<void, void>;

    constructor(vial: CxlCtxC_VialT, parent: ResumeCxlCtxC | null = null) {
        super(vial, parent);
        this._onRestart = new IgniterC<void, void>({
            spaResFactory: vial.spaResFactory,
            spaErrorFactory: vial.spaErrorFactory
        });
    }

    createResumeChild(): ResumeCxlCtxC {
        const child = new ResumeCxlCtxC(this._vial, this);
        (this as any)._children.add(child);
        return child;
    }

    /**
     * 再開（キャンセル状態を解除し、リスナを発火）
     */
    async restart(oprCtx: null = null): Promise<{ res: ResumeCxlCtx_RestartResT }> {
        if (this._parent?.isCanceled?.()) {
            throw new SpaError(SpaError_KindsE.Bug, 'Cannot restart a canceled context');
        }
        const res: ResumeCxlCtx_RestartResT = { igniterRes: [], childIgnitersRes: [] };
        if (this._canceled) {
            this._canceled = false;
            res.igniterRes = await this._onRestart.ignite(oprCtx);
            for (const child of this._children) {
                if (child instanceof ResumeCxlCtxC) {
                    res.childIgnitersRes.push((await child.restart(oprCtx)).res);
                }
            }
        }
        return { res };
    }
}

