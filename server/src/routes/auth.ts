import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/schemas';
import passport from 'passport';

const router = Router();

/* POST /api/auth/register - Register a new user */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      email,
      password_hash: passwordHash,
      first_name: firstName || undefined,
      last_name: lastName || undefined
    });

    // Set session
    req.session.userId = user._id.toString();

    res.status(201).json({ 
      message: 'User registered successfully',
      userId: user._id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/* POST /api/auth/login - Login existing user */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user._id.toString();

    res.json({ 
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* POST /api/auth/logout - Logout current user */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

/* GET /api/auth/me - Get current user info */
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.session.userId).select('-password_hash');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/* GET /api/auth/google -Redirect to Google for authentication */
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/* GET /api/auth/google/callback - Google redirects here after authentication */
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req: Request, res: Response) => {
    // Successful authentication
    req.session.userId = (req.user as any)._id.toString();
    res.redirect('http://localhost:5173/dashboard.html');
  }
);

export default router;