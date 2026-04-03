import passport from 'passport';

// Minimal passport setup — only local auth is used in this stripped server.
// No social providers.
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
