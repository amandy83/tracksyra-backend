export function createExecutionEvent(type, input) {
    return Object.freeze({
        type,
        ...input,
        payload: Object.freeze({ ...input.payload }),
    });
}
