import { MyValidationError } from "../errors.mjs";

export function getRoundIdFromReq(request) {
    let roundId = request.params?.round_id;
    if (!roundId) {
        throw new MyFatalError('MissingRouteParam');
    }
    roundId = parseInt(roundId);
    if (isNaN(roundId)) {
        throw new MyValidationError('Invalid Round ID');
    }
    if (typeof roundId !== 'number' || roundId <= 0 || !Number.isInteger(roundId)) {
        throw new MyValidationError('Invalid Round ID');
    }
    return roundId;
}
