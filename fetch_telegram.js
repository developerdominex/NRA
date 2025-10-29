import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME;

const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

const MESSAGES_PER_FILE = 500;
const MAX_FILES = 20; // optional limit for safety

async function main() {
  console.log("🔄 Fetching Telegram posts...");
  await client.connect();

  const channel = await client.getEntity(channelUsername);

  let allMessages = [];
  let offsetId = 0;
  let fileIndex = 1;

  // Keep fetching until no messages or size limit reached
  while (true) {
    const messages = await client.getMessages(channel, { limit: 100, addOffset: 0, offsetId });
    if (!messages.length) break;

    const formatted = messages
      .filter((m) => m.message || m.media)
      .map((m) => ({
        id: m.id,
        date: m.date,
        text: m.message || "",
        media: extractMedia(m),
      }));

    allMessages.push(...formatted);

    if (allMessages.length >= MESSAGES_PER_FILE) {
      saveChunk(allMessages.splice(0, MESSAGES_PER_FILE), fileIndex++);
      if (fileIndex > MAX_FILES) break;
    }

    offsetId = messages[messages.length - 1].id;
    console.log(`📦 Collected up to message ID: ${offsetId}`);
  }

  // Save remaining messages
  if (allMessages.length) {
    saveChunk(allMessages, fileIndex++);
  }

  await client.disconnect();
  console.log("✅ All done!");
}

function saveChunk(messages, index) {
  const filename = `telegram_posts_${index}.json`;
  fs.writeFileSync(filename, JSON.stringify(messages, null, 2));
  console.log(`💾 Saved ${messages.length} messages → ${filename}`);
}

function extractMedia(msg) {
  const media = [];
  if (msg.media && msg.media.webpage && msg.media.webpage.url) {
    media.push({ type: "link", url: msg.media.webpage.url });
  } else if (msg.photo) {
    media.push({
      type: "photo",
      url: `https://t.me/${process.env.TELEGRAM_CHANNEL_USERNAME}/${msg.id}`,
    });
  } else if (msg.video) {
    media.push({
      type: "video",
      url: `https://t.me/${process.env.TELEGRAM_CHANNEL_USERNAME}/${msg.id}`,
    });
  }
  return media;
}

main().catch((err) => console.error("❌ Error:", err));
