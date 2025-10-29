import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";
import path from "path";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME;
const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

const OUTPUT_PREFIX = "telegram_posts";
const MAX_PER_FILE = 500;

async function main() {
  console.log("🔄 Fetching Telegram posts...");
  await client.connect();
  const channel = await client.getEntity(channelUsername);

  console.log("📥 Fetching messages...");
  const messages = await client.getMessages(channel, { limit: 5000 }); 
  const newPosts = messages
    .filter(m => m.message || m.media)
    .map(m => ({
      id: m.id,
      date: m.date,
      text: m.message || "",
      media: extractMedia(m),
    }));

  // 🧩 Load old data
  const existing = loadExistingPosts();
  const existingIds = new Set(existing.map(p => p.id));

  // Filter out duplicates
  const merged = [...existing, ...newPosts.filter(p => !existingIds.has(p.id))];

  // Sort newest first
  merged.sort((a, b) => b.date - a.date);

  // 💾 Split into multiple JSON files (max 500 per file)
  splitAndSave(merged);

  console.log(`✅ Saved ${merged.length} unique posts (split into files).`);
  await client.disconnect();
}

function extractMedia(msg) {
  const media = [];
  if (msg.media?.webpage?.url) {
    media.push({ type: "link", url: msg.media.webpage.url });
  } else if (msg.photo) {
    media.push({ type: "photo", url: `https://t.me/${process.env.TELEGRAM_CHANNEL_USERNAME}/${msg.id}` });
  } else if (msg.video) {
    media.push({ type: "video", url: `https://t.me/${process.env.TELEGRAM_CHANNEL_USERNAME}/${msg.id}` });
  }
  return media;
}

function loadExistingPosts() {
  const posts = [];
  const files = fs.readdirSync(".").filter(f => f.startsWith(OUTPUT_PREFIX) && f.endsWith(".json"));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(f, "utf8"));
      posts.push(...data);
    } catch (err) {
      console.warn(`⚠️ Skipping invalid file: ${f}`);
    }
  }
  return posts;
}

function splitAndSave(allPosts) {
  const totalChunks = Math.ceil(allPosts.length / MAX_PER_FILE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = allPosts.slice(i * MAX_PER_FILE, (i + 1) * MAX_PER_FILE);
    const filename = `${OUTPUT_PREFIX}_${i + 1}.json`;
    fs.writeFileSync(filename, JSON.stringify(chunk, null, 2));
  }
  // Cleanup old extra files (if fewer chunks now)
  const files = fs.readdirSync(".").filter(f => f.startsWith(OUTPUT_PREFIX));
  for (let i = totalChunks + 1; i <= files.length; i++) {
    const f = `${OUTPUT_PREFIX}_${i}.json`;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

main().catch(err => console.error("❌ Error:", err));
