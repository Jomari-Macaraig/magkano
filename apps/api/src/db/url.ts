export type WriteTargetEnv = {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  VERCEL_ENV?: string;
};

export type WriteTarget = { url: string; logLine: string };

/**
 * The database `migrate` and `seed` write to: the direct `DATABASE_URL_UNPOOLED` when Neon
 * injects one, else `DATABASE_URL`. Never an empty URL. `logLine` names the Vercel
 * environment and the host only, so the build log never shows the password.
 */
export function writeTarget(task: string, env: WriteTargetEnv): WriteTarget {
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `${task}: neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set (see .env.example)`,
    );
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    // The URL itself stays out of the message: it holds the password.
    throw new Error(`${task}: the database URL is not a valid URL`);
  }
  return { url, logLine: `${task}: env=${env.VERCEL_ENV || "local"} host=${host}` };
}
