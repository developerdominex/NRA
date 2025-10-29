import fs from "fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import "dotenv/config";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME || "lmk1980";
const FILE_PATH = "./telegram_posts.json";

async function fetchTelegramPosts() {
  console.log("🔄 Fetching Telegram posts...");

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({ botAuthToken: botToken });

  const channel = await client.getEntity(channelUsername);
  const messages = await client.getMessages(channel, { limit: 50 });

  const posts = messages
    .filter((m) => m.message || m.media)
    .map((m) => ({
      id: m.id,
      text: m.message || "",
      date: m.date.toISOString(),
      hasMedia: !!m.media,
    }));

  // Read existing posts if available
  let existing = [];
  if (fs.existsSync(FILE_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    } catch {
      existing = [];
    }
  }

  const existingIds = new Set(existing.map((p) => p.id));
  const newPosts = posts.filter((p) => !existingIds.has(p.id));

  if (newPosts.length > 0) {
    const merged = [...posts, ...existing].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    fs.writeFileSync(FILE_PATH, JSON.stringify(merged, null, 2));
    console.log(`✅ Added ${newPosts.length} new post(s). Total: ${merged.length}`);
  } else {
    console.log("✅ No new posts found.");
  }

  await client.disconnect();
}

fetchTelegramPosts().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
