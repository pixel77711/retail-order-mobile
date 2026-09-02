const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "VITE_APP_ID",
  "OAUTH_SERVER_URL",
];

const production = process.env.NODE_ENV === "production";
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length === 0) {
  console.log("Environment check passed: all required API variables are available.");
  process.exit(0);
}

const message = `Missing ${production ? "production" : "development"} variables: ${missing.join(", ")}`;
if (production) {
  console.error(`Environment check failed: ${message}`);
  process.exit(1);
}

console.warn(`Environment check warning: ${message}. Development preview can run locally, but authenticated API flows require these values.`);
