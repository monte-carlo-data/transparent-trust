/**
 * Auth Configuration for Platform V2
 *
 * Simplified authentication that works with the new schema.
 * - No capabilities/roles (handled via team membership)
 * - Uses JWT strategy
 * - Primary: Okta (enterprise)
 * - Fallback: Google (if Okta not configured)
 * - Dev: Credentials login for local testing
 */

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import OktaProvider from "next-auth/providers/okta";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";

// Admin email whitelist - users with these emails automatically get admin role
// Configure via ADMIN_EMAILS environment variable (comma-separated list)
const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

// Build providers array conditionally
const providers: NextAuthOptions["providers"] = [];

// Primary: Add Okta provider (required for production)
if (process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER) {
  console.log("[Auth Init] Okta provider configured with issuer:", process.env.OKTA_ISSUER);
  providers.push(
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email groups",
        },
      },
    })
  );
} else {
  console.warn("[Auth Init] Okta provider NOT configured. Missing env vars:", {
    hasOktaClientId: !!process.env.OKTA_CLIENT_ID,
    hasOktaClientSecret: !!process.env.OKTA_CLIENT_SECRET,
    hasOktaIssuer: !!process.env.OKTA_ISSUER,
  });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log("[Auth Init] Google provider configured");
  // Fallback: Google OAuth if Okta not configured
  if (!providers.length) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: {
            access_type: "offline",
            prompt: "consent",
            scope: [
              "openid",
              "email",
              "profile",
              "https://www.googleapis.com/auth/presentations",
              "https://www.googleapis.com/auth/drive.readonly",
              "https://www.googleapis.com/auth/drive.file",
            ].join(" "),
            ...(process.env.GOOGLE_ALLOWED_DOMAINS && {
              hd: process.env.GOOGLE_ALLOWED_DOMAINS.split(",")[0],
            }),
          },
        },
      })
    );
  }
}

// Dev-only: Add credentials provider for local testing without OAuth
if (process.env.NODE_ENV !== "production") {
  providers.push(
    CredentialsProvider({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "dev@example.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split("@")[0],
              preferences: {},
            },
          });

          // Add to default team if exists
          const defaultTeam = await prisma.team.findUnique({
            where: { slug: 'default' },
          });
          if (defaultTeam) {
            // Determine role: admin if in whitelist, otherwise member
            const isAdmin = adminEmails.includes(credentials.email.toLowerCase());

            await prisma.teamMembership.create({
              data: {
                userId: user.id,
                teamId: defaultTeam.id,
                role: isAdmin ? 'admin' : 'member',
              },
            });
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("[Auth SignIn] Starting signIn callback", {
        provider: account?.provider,
        userId: user.id,
        hasProfile: !!profile,
        hasAccount: !!account,
      });

      if (account && profile && user.email) {
        try {
          // Find or create user by email
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!dbUser) {
            console.log("[Auth SignIn] User not found in DB, creating new user");
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split("@")[0],
                preferences: {},
              },
            });
            console.log("[Auth SignIn] Created new user:", dbUser.id);

            // Add to default team
            const defaultTeam = await prisma.team.findUnique({
              where: { slug: 'default' },
            });
            if (defaultTeam) {
              // Determine role: admin if in whitelist, otherwise member
              const isAdmin = adminEmails.includes(user.email.toLowerCase());
              console.log("[Auth SignIn] Adding user to default team as", isAdmin ? 'admin' : 'member');

              await prisma.teamMembership.create({
                data: {
                  userId: dbUser.id,
                  teamId: defaultTeam.id,
                  role: isAdmin ? 'admin' : 'member',
                },
              });
              console.log("[Auth SignIn] Team membership created successfully");
            } else {
              console.warn("[Auth SignIn] Default team not found!");
            }
          } else {
            console.log("[Auth SignIn] User already exists in DB");
            // Update user info
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                name: user.name || undefined,
              },
            });
            console.log("[Auth SignIn] Updated existing user info");
          }

          // Store OAuth tokens in Account table
          if (account.access_token) {
            console.log("[Auth SignIn] Storing OAuth tokens for", account.provider);
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {
                access_token: account.access_token,
                refresh_token: account.refresh_token || undefined,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
              create: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            });
            console.log("[Auth SignIn] OAuth tokens stored successfully");
          } else {
            console.warn("[Auth SignIn] No access_token in account object!");
          }

          console.log("[Auth SignIn] SignIn callback completed successfully");
        } catch (error) {
          console.error("[Auth SignIn] Error in signIn callback:", {
            error: error instanceof Error ? error.message : String(error),
            provider: account?.provider,
          });
          throw error; // Re-throw to allow NextAuth to handle the error
        }
      } else {
        console.warn("[Auth SignIn] Missing required data", {
          hasAccount: !!account,
          hasProfile: !!profile,
          hasEmail: !!user.email,
        });
      }
      return true;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        // Check if user is admin in any team
        try {
          const adminMembership = await prisma.teamMembership.findFirst({
            where: {
              userId: token.sub,
              role: 'admin',
            },
          });

          if (adminMembership) {
            session.user.isAdmin = true;
          }
        } catch (error) {
          console.error("[Auth Session] Error checking admin status:", {
            error: error instanceof Error ? error.message : String(error),
            userId: token.sub,
          });
        }
      } else {
        console.warn("[Auth Session] Missing session.user or token.sub", {
          hasSessionUser: !!session.user,
          hasTokenSub: !!token.sub,
        });
      }
      return session;
    },

    async jwt({ token, user }) {
      try {
        const email = user?.email || token.email;

        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: email as string },
            select: { id: true },
          });

          if (dbUser) {
            token.sub = dbUser.id;
          } else if (user) {
            token.sub = user.id;
          } else {
            console.warn("[Auth JWT] Could not find user in DB or user object");
          }
        } else {
          console.warn("[Auth JWT] No email found in user or token");
        }
      } catch (error) {
        console.error("[Auth JWT] Error in jwt callback:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

// Re-export for backwards compatibility with existing imports
export { authOptions as authOptionsV2 };

/**
 * Extended session user type with custom fields
 * Use this to properly type session.user when accessing custom properties
 */
export type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
  capabilities?: string[];
  role?: string;
};

/**
 * Check if a session user is an admin
 * Handles all the different ways admin status can be determined
 */
export function isUserAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;

  const capabilities = user.capabilities || [];
  return (
    user.isAdmin === true ||
    (user.role || "").toUpperCase() === "ADMIN" ||
    capabilities.includes("MANAGE_PROMPTS") ||
    capabilities.includes("ADMIN")
  );
}
