import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/schemas';

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user._id.toString());
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ oauth_id: profile.id, oauth_provider: 'google' });

        if (user) {
          // User exists, return user
          return done(null, user);
        }

        // Check if email already exists (user might have registered with email/password)
        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await User.findOne({ email });
          
          if (user) {
            // Link OAuth to existing account
            user.oauth_provider = 'google';
            user.oauth_id = profile.id;
            await user.save();
            return done(null, user);
          }
        }

        // Create new user
        user = await User.create({
          email: email || `${profile.id}@google.com`,
          first_name: profile.name?.givenName,
          last_name: profile.name?.familyName,
          oauth_provider: 'google',
          oauth_id: profile.id
        });

        done(null, user);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  )
);

export default passport;