import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.YOUTUBE_DATA_API_KEY;
const CHANNEL_HANDLE = "@luumyatkyaw-myanmar";
const FILE_PATH = "./information.json";

async function getUploadsPlaylistId(handle) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${handle.replace("@", "")}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.items || !data.items[0])
    throw new Error("Failed to get uploads playlist ID");
  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

async function fetchAllVideos(playlistId) {
  let videos = [];
  let nextPageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("maxResults", "50");
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    for (const item of data.items || []) {
      const s = item.snippet;
      if (!s?.resourceId?.videoId) continue;
      videos.push({
        title: s.title,
        youtubeURL: `https://www.youtube.com/watch?v=${s.resourceId.videoId}`,
        Date: new Date(s.publishedAt).getTime(),
      });
    }

    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  return videos;
}

async function main() {
  console.log("▶ Fetching latest YouTube videos...");
  const playlistId = await getUploadsPlaylistId(CHANNEL_HANDLE);
  const newVideos = await fetchAllVideos(playlistId);

  let existing = [];
  if (fs.existsSync(FILE_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    } catch {
      existing = [];
    }
  }

  const existingIds = new Set(existing.map(v => v.youtubeURL));
  const newUnique = newVideos.filter(v => !existingIds.has(v.youtubeURL));

  if (newUnique.length === 0) {
    console.log("✅ No new videos found.");
    return;
  }

  const merged = [...existing, ...newUnique].sort((a, b) => b.Date - a.Date);
  fs.writeFileSync(FILE_PATH, JSON.stringify(merged, null, 2));
  console.log(`✅ Added ${newUnique.length} new video(s). Total: ${merged.length}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
