import { MyFatalError, MyValidationError } from "../errors.mjs";

export function getUserIdFromReq(request) {
    const userId = request.params?.user_id;
    if (!userId) {
        throw new MyFatalError('MissingRouteParam');
    }
    const parsedUserId = parseInt(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw new MyValidationError('Invalid User ID');
    }
    return parsedUserId;
}