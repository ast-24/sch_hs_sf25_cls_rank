import { SpaResCI } from '../res/res.d';
import type { CxlCtxCI } from './cxlctx.d';

export type ResumeCxlCtx_RestartResT = {
    igniterRes: SpaResCI<void>[]
    childIgnitersRes: ResumeCxlCtx_RestartResT[]
}

export interface ResumeCxlCtxCI extends CxlCtxCI {
    restart(oprCtx?: null): Promise<{ res: ResumeCxlCtx_RestartResT }>;
    createResumeChild(): ResumeCxlCtxCI;
}
