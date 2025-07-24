export class MyResp extends Response {
    constructor(body, options = { status: 200 }) {
        super(body, options);
    }
}

export class MyJsonResp extends MyResp {
    constructor(data = 'ok', status = 200) {
        super(JSON.stringify(data), {
            status: status,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export class MyErrorResp extends MyJsonResp {
    constructor(
        status = 500,
        title = 'Internal Server Error',
        message = null
    ) {
        super(
            {
                status: status,
                title: title,
                message: message
            },
            status
        );
    }
}

export class MyFatalResp extends MyErrorResp {
    constructor(message = null) {
        super(500, 'Internal Server Error', message);
    }
}

export class MyTransientResp extends MyErrorResp {
    constructor(message = null) {
        super(503, 'Service Unavailable', message);
    }
}

export class MyBadRequestResp extends MyErrorResp {
    constructor(message = null) {
        super(400, 'Bad Request', message);
    }
}

export class MyNotFoundResp extends MyErrorResp {
    constructor(resource = null) {
        super(404, 'Not Found', `Resource not found: ${resource}`);
    }
}

export class MyStatusConflictResp extends MyErrorResp {
    constructor(resource = null) {
        super(409, 'Conflict', `Resource conflict: ${resource}`);
    }
}

export class MyValidationErrorResp extends MyErrorResp {
    constructor(message = null) {
        super(422, 'Unprocessable Entity', message);
    }
}