import { MyFatalError, MyValidationError } from "../errors.mjs";

export function getUserIdFromReq(request) {
    let userId = request.params?.user_id;
    if (!userId) {
        throw new MyFatalError('MissingRouteParam');
    }
    userId = parseInt(userId);
    if (isNaN(userId)) {
        throw new MyValidationError('Invalid User ID');
    }
    if (typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
        throw new MyValidationError('Invalid User ID');
    }
    return userId;
}