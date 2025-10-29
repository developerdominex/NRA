import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";
import "dotenv/config";

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME;

// Empty session since GitHub Actions can’t be interactive
const session = new StringSession("");

async function main() {
  console.log("🔄 Fetching Telegram posts...");
  const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
  await client.start({}); // No login required for public channels

  const channel = await client.getEntity(channelUsername);
  const messages = await client.getMessages(channel, { limit: 50 });

  const posts = messages
    .filter(msg => msg.message || msg.media)
    .map(msg => ({
      id: msg.id,
      text: msg.message || "",
      date: msg.date.toISOString(),
      photo: msg.photo ? `https://t.me/${channelUsername.replace("@", "")}/${msg.id}` : null,
      video: msg.video ? `https://t.me/${channelUsername.replace("@", "")}/${msg.id}` : null
    }));

  await fs.writeJson("telegram_posts.json", posts, { spaces: 2 });
  console.log(`✅ Saved ${posts.length} posts.`);
  await client.disconnect();
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
