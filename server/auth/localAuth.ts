import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { db } from "@db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { authStorage } from "./storage";
import { getSession } from "./session";

interface SessionUser {
  claims: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
  };
}

function toSessionUser(user: typeof users.$inferSelect): SessionUser {
  return {
    claims: {
      sub: user.id,
      email: user.email ?? undefined,
      first_name: user.firstName ?? undefined,
      last_name: user.lastName ?? undefined,
      profile_image_url: user.profileImageUrl ?? undefined,
    },
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email: string, password: string, done) => {
        try {
          const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Incorrect email or password" });
          }
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            return done(null, false, { message: "Incorrect email or password" });
          }
          return done(null, toSessionUser(user) as Express.User);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body || {};
      if (!email || !password || String(password).length < 8) {
        return res.status(400).json({
          message: "Email and a password of at least 8 characters are required",
        });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [user] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          subscriptionStatus: "trial",
          trialEndsAt,
        })
        .returning();

      req.login(toSessionUser(user) as Express.User, (err) => {
        if (err) {
          console.error("Login after registration failed:", err);
          return res.status(500).json({ message: "Registered, but failed to start session" });
        }
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message?: string }) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Failed to log in" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Incorrect email or password" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Session start error:", loginErr);
          return res.status(500).json({ message: "Failed to start session" });
        }
        res.json({ success: true });
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !(req.user as SessionUser | undefined)?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export { authStorage };
