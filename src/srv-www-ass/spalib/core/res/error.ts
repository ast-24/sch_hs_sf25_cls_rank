import {
    SpaErrorCI,
    SpaErrorFactoryCI,
    SpaError_KindsE,
    SpaError_LevelE
} from "./error.d";

export class SpaErrorC extends Error implements SpaErrorCI {
    public readonly name: string = 'SpaError';
    public readonly kind: SpaError_KindsE;
    public readonly message: string;
    public readonly stack?: string;
    public readonly cause?: Error;

    public constructor(kind: SpaError_KindsE, message?: string, cause?: Error) {
        super(message);
        this.kind = kind;
        this.message = message || 'An error occurred';
        this.cause = cause;
    }

    public toString(title?: string, level?: SpaError_LevelE): string {
        return `[ERROR] ${title ? `${title}: ` : ''}${this.name}: ${this.kind}: ${this.message}: ${this.stack} (caused by: ${this.cause ? `${this.cause.name}: ${this.cause.message}: ${this.cause.stack}` : 'unknown'})`;
    }

    public logging(title?: string, level?: SpaError_LevelE): void {
        switch (level) {
            case SpaError_LevelE.Error:
                console.error(this.toString(title, level));
                break;
            case SpaError_LevelE.Warn:
                console.warn(this.toString(title, level));
                break;
            case SpaError_LevelE.Info:
                console.info(this.toString(title, level));
                break;
        }
    }
}

export class SpaErrorFactoryC implements SpaErrorFactoryCI {
    public create(kind: SpaError_KindsE, message: string, cause?: Error): SpaErrorCI {
        return new SpaErrorC(kind, message, cause);
    }
    public createFrom(error: any): SpaErrorCI {
        if (error instanceof SpaErrorC) {
            return error;
        }
        return new SpaErrorC(
            SpaError_KindsE.Unexpected,
            error.message || 'An unexpected error occurred'
        );
    }
}
