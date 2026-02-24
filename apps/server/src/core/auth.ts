import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { URLS, DEV_URLS } from "@mdplane/shared";
import { db } from "../db";
import * as schema from "../db/schema";
import { serverEnv } from "../config/env";

const isProduction = serverEnv.isProduction;
const isTest = serverEnv.isTest;

function isMdplaneDomainUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    return new URL(url).hostname.endsWith('mdplane.dev');
  } catch {
    return false;
  }
}

const isMdplaneHosted = isMdplaneDomainUrl(serverEnv.betterAuthUrl)
  || isMdplaneDomainUrl(serverEnv.appUrl);
const useSecureCookies = isProduction || isMdplaneHosted;
const useCrossSubDomainCookies = useSecureCookies && isMdplaneHosted;
const socialProviders = serverEnv.governedModeEnabled
  ? {
      github: {
        clientId: serverEnv.githubClientId || '',
        clientSecret: serverEnv.githubClientSecret || '',
      },
      google: {
        clientId: serverEnv.googleClientId || '',
        clientSecret: serverEnv.googleClientSecret || '',
      },
    }
  : {};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
      verification: schema.authVerification,
    },
  }),
  baseURL: serverEnv.betterAuthUrl,
  secret: serverEnv.betterAuthSecret,

  advanced: {
    useSecureCookies,
    ...(useCrossSubDomainCookies && {
      crossSubDomainCookies: {
        enabled: true,
        domain: URLS.COOKIE_DOMAIN,
      },
    }),
  },

  trustedOrigins: [
    serverEnv.appUrl,
    'http://localhost:3000',
    DEV_URLS.APP,
    DEV_URLS.API,
    URLS.APP,
    URLS.API,
  ],

  socialProviders,

  emailAndPassword: {
    enabled: isTest,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
