import { z } from 'zod';
import { VideoQueueItem } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { extractYouTubeId, thumbnailFor, watchUrl, fetchOEmbed } from '../utils/youtube.js';

export const PERSONAL_RESOURCE_NOTICE =
  'This is your personal resource. The primary recommended video remains the official path resource.';

export const addSchema = z.object({
  url: z.string().min(5, 'Paste a YouTube URL or video ID'),
  title: z.string().max(200).optional(),
  relatedTopic: z.string().max(120).optional(),
  relatedLessonId: z.string().optional().nullable(),
  personalNotes: z.string().max(5000).optional(),
});

export const listQueue = asyncHandler(async (req, res) => {
  const items = await VideoQueueItem.find({ userId: req.user._id })
    .populate('relatedLessonId', 'title slug')
    .sort({ bookmarked: -1, order: 1, createdAt: -1 })
    .lean();
  return ok(res, { items, notice: PERSONAL_RESOURCE_NOTICE });
});

/** Validate a YouTube URL and add it to the student's personal queue. */
export const addToQueue = asyncHandler(async (req, res) => {
  const { url, title, relatedTopic, relatedLessonId, personalNotes } = req.body;

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw ApiError.badRequest(
      'That does not look like a valid YouTube link. Paste a full URL (youtube.com/watch?v=..., youtu.be/...) or an 11-character video ID.'
    );
  }

  const existing = await VideoQueueItem.findOne({ userId: req.user._id, youtubeVideoId: videoId });
  if (existing) throw ApiError.conflict('This video is already in your queue');

  // Best-effort public metadata (no API key, no transcript scraping).
  const meta = await fetchOEmbed(videoId);

  const count = await VideoQueueItem.countDocuments({ userId: req.user._id });

  const item = await VideoQueueItem.create({
    userId: req.user._id,
    youtubeVideoId: videoId,
    originalUrl: watchUrl(videoId),
    title: title || meta?.title || 'Personal resource',
    channelName: meta?.channelName || '',
    thumbnail: meta?.thumbnail || thumbnailFor(videoId),
    relatedTopic: relatedTopic || '',
    relatedLessonId: relatedLessonId || null,
    personalNotes: personalNotes || '',
    order: count,
  });

  return created(res, { item, notice: PERSONAL_RESOURCE_NOTICE }, 'Added to your video queue');
});

export const updateQueueItem = asyncHandler(async (req, res) => {
  const item = await VideoQueueItem.findOne({ _id: req.params.id, userId: req.user._id });
  if (!item) throw ApiError.notFound('Video not found in your queue');

  const fields = ['title', 'personalNotes', 'relatedTopic', 'lastTimestamp', 'watchedSeconds', 'percent', 'completed', 'order'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) item[f] = req.body[f];
  });
  if (req.body.percent !== undefined && req.body.percent >= 95) item.completed = true;

  await item.save();
  return ok(res, { item }, 'Saved');
});

export const toggleQueueBookmark = asyncHandler(async (req, res) => {
  const item = await VideoQueueItem.findOne({ _id: req.params.id, userId: req.user._id });
  if (!item) throw ApiError.notFound('Video not found in your queue');
  item.bookmarked = !item.bookmarked;
  await item.save();
  return ok(res, { item }, item.bookmarked ? 'Bookmarked' : 'Bookmark removed');
});

export const deleteQueueItem = asyncHandler(async (req, res) => {
  const item = await VideoQueueItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!item) throw ApiError.notFound('Video not found in your queue');
  return ok(res, { id: req.params.id }, 'Removed from your queue');
});

/** Validation-only endpoint used by the UI before adding. */
export const validateUrl = asyncHandler(async (req, res) => {
  const videoId = extractYouTubeId(req.body.url || req.query.url);
  if (!videoId) throw ApiError.badRequest('Invalid YouTube URL or video ID');
  const meta = await fetchOEmbed(videoId);
  return ok(res, {
    valid: true,
    videoId,
    thumbnail: thumbnailFor(videoId),
    title: meta?.title || '',
    channelName: meta?.channelName || '',
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  });
});
