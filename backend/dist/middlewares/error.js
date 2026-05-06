"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
exports.errorHandler = errorHandler;
function notFound(_req, res) {
    res.status(404).json({ error: 'not_found' });
}
function errorHandler(err, _req, res, _next) {
    const message = err instanceof Error ? err.message : 'internal_error';
    const status = message === 'run_not_found' ? 404
        : message === 'run_not_active' ? 409
            : 500;
    if (status >= 500) {
        // eslint-disable-next-line no-console
        console.error('[error]', err);
    }
    res.status(status).json({ error: message });
}
