import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME;

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

const LIMIT_PER_FILE = 1000; // store 1000 messages per JSON file

async function main() {
  console.log("🔄 Fetching Telegram posts...");
  await client.connect();

  const channel = await client.getEntity(channelUsername);
  let offsetId = 0;
  let allPosts = [];
  let fileIndex = 1;
  let totalCount = 0;

  while (true) {
    const messages = await client.getMessages(channel, { limit: 100, offsetId });
    if (!messages.length) break;

    const posts = messages.map((m) => ({
      id: m.id,
      username: channelUsername.replace("@", ""),
    }));

    allPosts.push(...posts);
    totalCount += posts.length;
    offsetId = messages[messages.length - 1].id;

    if (allPosts.length >= LIMIT_PER_FILE) {
      saveBatch(fileIndex, allPosts);
      allPosts = [];
      fileIndex++;
    }

    // Optional: small delay to avoid floodwaits
    await new Promise((r) => setTimeout(r, 300));
  }

  if (allPosts.length > 0) saveBatch(fileIndex, allPosts);

  console.log(`✅ Done. Total posts saved: ${totalCount}`);
  await client.disconnect();
}

function saveBatch(index, posts) {
  const path = `./telegram_posts_${index}.json`;
  fs.writeFileSync(path, JSON.stringify(posts, null, 2));
  console.log(`💾 Saved ${posts.length} posts → ${path}`);
}

main().catch((err) => console.error("❌ Error:", err));
