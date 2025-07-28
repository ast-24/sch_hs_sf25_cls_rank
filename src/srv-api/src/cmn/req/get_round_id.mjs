import { MyFatalError, MyValidationError } from "../errors.mjs";

export function getRoundIdFromReq(request) {
    const roundId = request.params?.round_id;
    if (!roundId) {
        throw new MyFatalError('MissingRouteParam');
    }
    const parsedRoundId = parseInt(roundId);
    if (!Number.isInteger(parsedRoundId) || parsedRoundId <= 0) {
        throw new MyValidationError('Invalid Round ID');
    }
    return parsedRoundId;
}
