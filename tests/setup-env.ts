import { config } from "dotenv";

config({ path: ".env.local" });
config();
config({ path: ".env.test.local", override: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Run `npm run db:test:setup` first.",
  );
}
if (!/_test/.test(testUrl)) {
  throw new Error(
    "TEST_DATABASE_URL must point at a database containing `_test`; refusing to run against a real database.",
  );
}

// The app reads DATABASE_URL through one accessor; tests point it at the test DB.
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_URL_UNPOOLED = testUrl;
