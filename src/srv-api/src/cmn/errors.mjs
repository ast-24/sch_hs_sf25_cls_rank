import { logError } from "./log-error.mjs";
import {
    MyBadRequestResp,
    MyFatalResp,
    MyNotFoundResp,
    MyConflictResp,
    MyTransientResp,
    MyValidationErrorResp
} from "./resp.mjs";

export class MyError extends Error {
    name;
    detail;
    resp;

    constructor(
        name = 'UnxpectedError',
        detail = null,
        resp = null,
    ) {
        super();
        this.name = name;
        this.detail = detail;
        this.resp = resp;
    }

    intoString() {
        return `[${new Date().toISOString()}] ${this.name}: ${this.detail} ${this.stack ? `\n${this.stack}` : ''}`;
    }

    intoResp() {
        return this.resp || new MyFatalResp(`An error occurred`);
    }

    async logging(env) {
        await logError(this, env);
        console.error(`[Error] ${this.intoString()}`);
        return this;
    }
}


export class MyFatalError extends MyError {
    constructor(detail = null, message = null) {
        super(
            'FatalError',
            detail,
            new MyFatalResp(message)
        );
    }
}

export class MyTransientError extends MyError {
    constructor(detail = null, message = null) {
        super(
            'TransientError',
            detail,
            new MyTransientResp(message)
        );
    }
}

export class MyBadRequestError extends MyError {
    constructor(message = null) {
        super(
            'BadRequestError',
            null,
            new MyBadRequestResp(message)
        );
    }
}

export class MyNotFoundError extends MyError {
    constructor(resource = null) {
        super(
            'NotFoundError',
            null,
            new MyNotFoundResp(resource)
        );
    }
}

export class MyConflictError extends MyError {
    constructor(resource = null) {
        super(
            'ConflictError',
            null,
            new MyConflictResp(resource)
        );
    }
}

export class MyValidationError extends MyError {
    constructor(detail = null) {
        super(
            'ValidationError',
            null,
            new MyValidationErrorResp(detail)
        );
    }
}