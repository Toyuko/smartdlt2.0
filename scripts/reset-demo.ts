import { seedDemo } from "./seed";

if (process.env.DEMO_RESET_ENABLED !== "true") {
  console.error("Refusing to reset. Set DEMO_RESET_ENABLED=true for an explicit demo reset.");
  process.exit(1);
}

if (process.env.VERCEL_ENV === "production" && process.env.DEMO_RESET_ALLOW_PRODUCTION !== "true") {
  console.error("Refusing to reset production. Set DEMO_RESET_ALLOW_PRODUCTION=true only for a deliberate demo wipe.");
  process.exit(1);
}

seedDemo({ replace: true }).catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
