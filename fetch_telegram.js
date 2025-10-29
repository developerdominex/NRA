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
  const messages = await client.getMessages(channel, { limit: 100 });

  const posts = messages
    .filter((m) => m.message || m.media)
    .map((m) => ({
      id: m.id,
      date: m.date,
      text: m.message || "",
      media: extractMedia(m),
    }));

  fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
  console.log(`✅ Saved ${posts.length} posts to ${outputPath}`);

  await client.disconnect();
}

function extractMedia(msg) {
  const media = [];
  if (msg.media && msg.media.webpage && msg.media.webpage.url) {
    media.push({ type: "link", url: msg.media.webpage.url });
  } else if (msg.photo) {
    const fileRef = msg.photo;
    media.push({
      type: "photo",
      url: `https://t.me/${channelUsername}/${msg.id}`,
    });
  } else if (msg.video) {
    media.push({
      type: "video",
      url: `https://t.me/${channelUsername}/${msg.id}`,
    });
  }
  return media;
}

main().catch((err) => console.error("❌ Error:", err));
