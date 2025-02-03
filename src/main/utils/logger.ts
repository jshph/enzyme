import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export function initializeLogger(name: string): winston.Logger {
  const logPath = path.join(app.getPath('userData'), 'logs');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
  }

  // Clear existing log files
  const logFiles = [`error_${name}.log`, `combined_${name}.log`];
  for (const file of logFiles) {
    const filePath = path.join(logPath, file);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '');
    }
  }

  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ 
        filename: path.join(logPath, `error_${name}.log`), 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: path.join(logPath, `combined_${name}.log`)
      })
    ]
  });

  logger.info(`${name} logger initialized`);
  return logger;
}