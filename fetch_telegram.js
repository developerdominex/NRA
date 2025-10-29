import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME;
const outputPath = "./telegram_posts.json";

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

async function main() {
  console.log("🔄 Fetching Telegram posts...");
  await client.connect();

  const channel = await client.getEntity(channelUsername);

  let offsetId = 0;
  const limit = 100;
  const allMessages = [];

  // Fetch in batches
  while (true) {
    const messages = await client.getMessages(channel, { limit, addOffset: 0, offsetId });
    if (!messages.length) break;
    allMessages.push(...messages);
    offsetId = messages[messages.length - 1].id;
    if (messages.length < limit) break;
  }

  console.log(`📥 Retrieved ${allMessages.length} messages from ${channelUsername}`);

  // Prepare post objects
  const posts = [];
  for (const m of allMessages) {
    if (!m.message && !m.media) continue;

    const post = {
      id: m.id,
      date: m.date,
      text: m.message || "",
      media: [],
    };

    // Extract media
    if (m.media) {
      try {
        const fileInfo = await client.downloadMedia(m.media, {
          workers: 1,
          outputFile: false,
        });
        if (typeof fileInfo === "string" && fileInfo.startsWith("https://")) {
          const type = m.photo ? "photo" : m.video ? "video" : "file";
          post.media.push({ type, url: fileInfo });
        }
      } catch (err) {
        console.warn(`⚠️ Failed to load media for message ${m.id}: ${err.message}`);
      }
    }

    posts.push(post);
  }

  // Sort newest first
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
  console.log(`✅ Saved ${posts.length} posts to ${outputPath}`);

  await client.disconnect();
}

main().catch((err) => console.error("❌ Error:", err));
