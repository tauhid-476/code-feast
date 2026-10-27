import { config } from "dotenv";

// Local first, then plain .env as a fallback. `.env.local` is gitignored.
config({ path: ".env.local" });
config();
