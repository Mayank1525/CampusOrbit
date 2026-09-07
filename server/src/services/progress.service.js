import { StudentProgress, Milestone } from '../models/index.js';

/**
 * Atomically fetch-or-create a StudentProgress document for (userId, pathId).
 *
 * Why this exists
 * ---------------
 * `StudentProgress` has a unique compound index on { userId, pathId }. The old
 * "findOne, and if missing then create" pattern is a read-modify-write race:
 * two requests that arrive close together (an impatient double-click, React
 * StrictMode double-invoking an effect in dev, or a retried request) both see
 * "no document", both insert, and the loser hits an E11000 duplicate-key error.
 * The generic error handler turned that into the very confusing user-facing
 * message "That userId is already in use".
 *
 * `findOneAndUpdate` with `$setOnInsert` + `upsert` pushes the whole operation
 * into a single atomic MongoDB command, so concurrent callers converge on one
 * document instead of fighting. The `defaults` are applied ONLY on insert, so
 * an existing record is never clobbered.
 *
 * The E11000 catch is a belt-and-braces fallback: under a genuinely simultaneous
 * upsert MongoDB can still raise a duplicate-key error, in which case the
 * document provably exists and a plain read is the correct answer.
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} pathId
 * @param {object} defaults extra fields applied only when the doc is created
 * @returns {Promise<import('mongoose').Document>} a hydrated StudentProgress doc
 */
export async function getOrCreateProgress(userId, pathId, defaults = {}) {
  // Build the default milestone ladder only when we may need it.
  let seedMilestones = defaults.milestones;
  if (!seedMilestones) {
    const milestones = await Milestone.find({ pathId }).sort({ order: 1 }).select('_id');
    seedMilestones = milestones.map((m, i) => ({
      milestoneId: m._id,
      status: i === 0 ? 'current' : 'locked',
    }));
  }

  const { milestones: _ignored, ...rest } = defaults;

  try {
    return await StudentProgress.findOneAndUpdate(
      { userId, pathId },
      { $setOnInsert: { userId, pathId, milestones: seedMilestones, ...rest } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Lost an exactly-simultaneous upsert race: the document now exists.
    if (err?.code === 11000) {
      const existing = await StudentProgress.findOne({ userId, pathId });
      if (existing) return existing;
    }
    throw err;
  }
}

export default getOrCreateProgress;
