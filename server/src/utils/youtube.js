/** Extract a YouTube video id from a URL or accept a raw 11-char id. */
export function extractYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();

  // Raw video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const re of patterns) {
    const m = value.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

export function thumbnailFor(videoId, quality = 'hqdefault') {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

export function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Best-effort public metadata via oEmbed (no API key). Fails soft. */
export async function fetchOEmbed(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return {
      title: json.title,
      channelName: json.author_name,
      thumbnail: json.thumbnail_url,
    };
  } catch {
    return null;
  }
}
