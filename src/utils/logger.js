// src/utils/logger.js
import { createLogger, transports, format } from 'winston';

// Create a new logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({ format: format.combine(format.colorize(), format.simple()) }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

export { logger };
