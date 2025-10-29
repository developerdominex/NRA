import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const OUTPUT_PREFIX = "telegram_posts_";
const INDEX_FILE = "telegram_index.json";

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

  while (true) {
    const messages = await client.getMessages(channel, { limit, offsetId });
    if (!messages.length) break;
    allMessages.push(...messages);
    offsetId = messages[messages.length - 1].id;
    if (messages.length < limit) break;
  }

  console.log(`📥 Retrieved ${allMessages.length} messages`);

  const posts = [];
  for (const m of allMessages) {
    if (!m.message && !m.media) continue;
    const post = {
      id: m.id,
      date: m.date,
      text: m.message || "",
      media: [],
    };

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

  // Split into multiple files (5MB max)
  const files = [];
  let part = 1;
  let chunk = [];
  let currentSize = 0;

  for (const post of posts) {
    const postSize = Buffer.byteLength(JSON.stringify(post), "utf8");
    if (currentSize + postSize > MAX_FILE_SIZE && chunk.length) {
      const fileName = `${OUTPUT_PREFIX}${part}.json`;
      fs.writeFileSync(fileName, JSON.stringify(chunk, null, 2));
      files.push(fileName);
      part++;
      chunk = [];
      currentSize = 0;
    }
    chunk.push(post);
    currentSize += postSize;
  }

  if (chunk.length) {
    const fileName = `${OUTPUT_PREFIX}${part}.json`;
    fs.writeFileSync(fileName, JSON.stringify(chunk, null, 2));
    files.push(fileName);
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify({ files }, null, 2));

  console.log(`✅ Saved ${posts.length} posts into ${files.length} files`);
  await client.disconnect();
}

main().catch((err) => console.error("❌ Error:", err));
