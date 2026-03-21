/**
 * Centralized error handler.
 */
export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Resursen hittades inte' });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Resursen finns redan', field: err.meta?.target });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internt serverfel' : err.message,
  });
}
