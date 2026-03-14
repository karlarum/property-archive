import { Request, Response, NextFunction } from 'express';

// Express Session
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

/* Check if user is authenticated */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.userId) {
    // User is authenticated
    next();
  } else {
    // User is not authenticated
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'You must be logged in to access this resource' 
    });
  }
}

/* Middleware to attach user info to request */
export function attachUser(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.userId) {
    (req as any).userId = req.session.userId;
  }
  next();
}