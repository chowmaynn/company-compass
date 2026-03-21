const API_KEY = "AIzaSyCQG-IxYCAHZvHgw3spZKCrdehkAQRsSZo";
const BASE_URL = "https://www.googleapis.com/youtube/v3";

export interface ChannelStats {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

export interface VideoItem {
  id: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getChannelStats(channelId: string): Promise<ChannelStats> {
  const url = `${BASE_URL}/channels?part=statistics&id=${channelId}&key=${API_KEY}`;
  const data = await fetchJSON<any>(url);

  if (!data.items?.length) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const stats = data.items[0].statistics;
  return {
    subscriberCount: parseInt(stats.subscriberCount, 10),
    viewCount: parseInt(stats.viewCount, 10),
    videoCount: parseInt(stats.videoCount, 10),
  };
}

export async function getRecentVideos(
  channelId: string,
  publishedAfter?: string,
  publishedBefore?: string,
  maxResults = 50
): Promise<VideoItem[]> {
  let searchUrl = `${BASE_URL}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${API_KEY}`;
  if (publishedAfter) {
    searchUrl += `&publishedAfter=${publishedAfter}`;
  }
  if (publishedBefore) {
    searchUrl += `&publishedBefore=${publishedBefore}`;
  }

  const searchData = await fetchJSON<any>(searchUrl);
  const items = searchData.items || [];

  if (items.length === 0) return [];

  const videoIds = items.map((item: any) => item.id.videoId).join(",");
  const statsUrl = `${BASE_URL}/videos?part=statistics,snippet&id=${videoIds}&key=${API_KEY}`;
  const statsData = await fetchJSON<any>(statsUrl);

  return (statsData.items || []).map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    viewCount: parseInt(item.statistics.viewCount, 10),
    likeCount: parseInt(item.statistics.likeCount, 10),
    commentCount: parseInt(item.statistics.commentCount, 10),
  }));
}
