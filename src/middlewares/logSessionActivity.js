import { createLogger, format, transports } from "winston";

export const logSessionActivity = (req, res, next) => {
  const userLabel = req.user ? `User: ${req.user.email}` : "Restro Api Logs";
  console.log(`[Session] ${userLabel} - ${req.method} ${req.originalUrl}`);
  next();
};
