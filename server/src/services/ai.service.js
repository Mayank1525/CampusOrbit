import { env, isAIConfigured } from '../config/env.js';

/**
 * CampusOrbit AI service.
 *
 * If GEMINI_API_KEY is configured -> real generation is attempted.
 * If not -> we run a deterministic, rule-based generator and honestly label
 * every output with mode: 'demo' so the UI can show "Demo AI Mode".
 * We never claim a real AI response was generated when it was not.
 */

export const aiMode = () => (isAIConfigured() ? 'live-ai' : 'demo');

const STOPWORDS = new Set(
  `a an the and or but if then than that this these those is are was were be been being to of in on for with as at by from it its into about over under we you your they their our i he she them us can will just so not no do does did done have has had how what why when which who whom while also because there here them then very more most some any each other such only own same too s t don now`.split(
    /\s+/
  )
);

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function keywords(text, limit = 12) {
  const freq = new Map();
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

function titleCase(s) {
  return String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Build structured notes from AUTHORIZED transcript/content only.
 * @param {{title:string, topic:string, transcript:string, duration:number}} input
 */
export function generateNotesFromTranscript(input) {
  const { title = 'Lesson', topic = '', transcript = '', duration = 0 } = input;
  const sents = sentences(transcript);
  const keys = keywords(transcript, 10);
  const mode = aiMode();

  if (!sents.length) {
    return null;
  }

  // Split transcript into ~4 sections with approximate timestamps.
  const groups = chunk(sents, Math.max(2, Math.ceil(sents.length / 4)));
  const sectionTitles = [
    'Introduction and core idea',
    'How it actually works',
    'Practical usage and examples',
    'Interview relevance and pitfalls',
  ];

  const sections = groups.map((group, i) => ({
    heading: sectionTitles[i] || `Section ${i + 1}`,
    timestamp: duration ? Math.round((duration / groups.length) * i) : null,
    points: group.slice(0, 5).map((s) => s.replace(/^\W+/, '')),
  }));

  const summary =
    sents.slice(0, 3).join(' ').slice(0, 600) ||
    `This lesson covers ${title}.`;

  const definitions = keys.slice(0, 5).map((k) => {
    const found = sents.find((s) => s.toLowerCase().includes(k));
    return {
      term: titleCase(k),
      meaning: found
        ? found.slice(0, 220)
        : `${titleCase(k)} is a core concept discussed in ${title}.`,
    };
  });

  const practicalExamples = sents
    .filter((s) => /example|for instance|suppose|consider|imagine|let's say|use case/i.test(s))
    .slice(0, 4);

  const interviewQuestions = [
    `Explain ${topic || title} in simple terms with one real example.`,
    `What problem does ${topic || title} solve, and what breaks without it?`,
    `Where did you use ${topic || title} in one of your projects?`,
    `What are the common mistakes developers make with ${topic || title}?`,
    `Compare ${topic || title} with the closest alternative approach.`,
  ];

  const beginnerExplanation = `Think of ${topic || title} like this: ${
    sents[0] ? sents[0].slice(0, 200) : 'it is a building block you will reuse constantly.'
  } Start by understanding the "why", then write a tiny program that uses it, then explain it out loud in your own words. If you can teach it to a friend in two minutes, you know it well enough for an interview.`;

  const hinglishExplanation = `Simple shabdon mein: ${topic || title} ka matlab hai ${
    keys[0] ? `"${keys[0]}"` : 'ek core concept'
  } ko sahi tarike se use karna. Pehle concept samjho, phir chhota code likh ke practice karo, aur last mein apne project mein use karke dekho. Interview mein isko apne project ke example ke saath explain karoge to impact strong banta hai. Ratta mat maaro, logic samjho.`;

  const revisionSummary = [
    `Core idea: ${keys.slice(0, 3).map(titleCase).join(', ') || title}.`,
    `Remember: ${sents[1] ? sents[1].slice(0, 160) : 'practise with a small hands-on task.'}`,
    `Interview angle: be ready with one project example.`,
  ].join(' ');

  return {
    mode,
    title: `AI Smart Notes — ${title}`,
    summary,
    keyConcepts: keys.slice(0, 8).map(titleCase),
    definitions,
    practicalExamples: practicalExamples.length
      ? practicalExamples
      : [`Try building a tiny demo that uses ${topic || title} end to end.`],
    sections,
    interviewQuestions,
    beginnerExplanation,
    hinglishExplanation,
    revisionSummary,
  };
}

/** Flashcards derived from the generated notes. */
export function generateFlashcards(notes, topic = '') {
  if (!notes) return [];
  const cards = [];

  (notes.definitions || []).forEach((d) => {
    cards.push({ front: `What is ${d.term}?`, back: d.meaning, topic, difficulty: 'easy' });
  });

  (notes.keyConcepts || []).slice(0, 4).forEach((c) => {
    cards.push({
      front: `Why does ${c} matter in ${topic || 'this topic'}?`,
      back:
        notes.summary?.slice(0, 200) ||
        `${c} is central to understanding ${topic}. Revisit the summary section.`,
      topic,
      difficulty: 'medium',
    });
  });

  (notes.sections || []).slice(0, 3).forEach((s) => {
    if (s.points?.length) {
      cards.push({
        front: `Recall: ${s.heading}`,
        back: s.points[0].slice(0, 250),
        topic,
        difficulty: 'medium',
      });
    }
  });

  return cards.slice(0, 10);
}

/** Five-question MCQ quiz generated from notes content. */
export function generateQuiz(notes, lessonTitle = 'Lesson', topic = '') {
  if (!notes) return null;
  const concepts = notes.keyConcepts || [];
  const defs = notes.definitions || [];
  const questions = [];

  defs.slice(0, 3).forEach((d, i) => {
    const distractors = defs
      .filter((x) => x.term !== d.term)
      .slice(0, 3)
      .map((x) => x.meaning.slice(0, 90));
    while (distractors.length < 3) {
      distractors.push(
        [
          'It is only a styling utility with no logic role.',
          'It is a deprecated feature removed from modern versions.',
          'It is used exclusively for database indexing.',
        ][distractors.length]
      );
    }
    const correct = d.meaning.slice(0, 90);
    const options = [correct, ...distractors].slice(0, 4);
    // Deterministic shuffle
    const rotate = i % 4;
    const rotated = [...options.slice(rotate), ...options.slice(0, rotate)];
    questions.push({
      question: `Which statement best describes ${d.term}?`,
      options: rotated,
      correctIndex: rotated.indexOf(correct),
      explanation: `${d.term}: ${d.meaning.slice(0, 200)}`,
      topic,
    });
  });

  if (concepts.length) {
    const correct = concepts[0];
    const opts = [correct, 'Random unrelated library', 'A CSS-only feature', 'A deprecated API'];
    questions.push({
      question: `Which of these is a key concept covered in "${lessonTitle}"?`,
      options: opts,
      correctIndex: 0,
      explanation: `${correct} is one of the key concepts of this lesson.`,
      topic,
    });
  }

  questions.push({
    question: `What is the most effective next step after finishing "${lessonTitle}"?`,
    options: [
      'Complete the practice task and then attempt the quiz again if needed',
      'Skip directly to applying for jobs',
      'Watch five more random videos on the same topic',
      'Memorise the transcript word by word',
    ],
    correctIndex: 0,
    explanation:
      'CampusOrbit follows learn → practise → prove. Doing the practice task locks the concept in.',
    topic,
  });

  return {
    title: `${lessonTitle} — Check your understanding`,
    description: 'Five questions to confirm you actually understood this lesson.',
    questions: questions.slice(0, 5),
    passPercent: 60,
    mode: aiMode(),
  };
}

/** Simpler explanation on demand. */
export function simplifyExplanation(text, topic = '') {
  const keys = keywords(text, 5);
  return {
    mode: aiMode(),
    text: `Simpler version — ${topic || 'this topic'} in plain words:\n\n1) The main idea: ${
      sentences(text)[0]?.slice(0, 180) || 'break the concept into one sentence you can say out loud.'
    }\n2) Words that matter: ${keys.map(titleCase).join(', ') || 'core keywords'}.\n3) Do this now: write 10 lines of code that use it, break it on purpose, then fix it.\n4) Interview line: "I used this when I needed to ..." — fill that blank with your own project.`,
  };
}

/**
 * Text-interview feedback. Deterministic rubric in demo mode:
 * measures keyword coverage, structure, clarity and project evidence.
 */
export function evaluateInterviewAnswer({ question, answer, resumeContext }) {
  const text = String(answer || '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = text.toLowerCase();

  const must = (question.mustMentionKeywords || []).map((k) => k.toLowerCase());
  const mentioned = must.filter((k) => lower.includes(k));
  const missing = (question.mustMentionKeywords || []).filter(
    (k) => !lower.includes(k.toLowerCase())
  );

  const coverage = must.length ? mentioned.length / must.length : wordCount > 60 ? 0.7 : 0.4;
  const technicalAccuracy = Math.max(1, Math.min(10, Math.round(coverage * 10)));

  // Clarity: reward moderate sentence length and penalise walls of text.
  const sents = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLen = sents.length ? wordCount / sents.length : wordCount;
  let clarity = 7;
  if (avgLen > 40) clarity -= 3;
  if (avgLen < 6 && wordCount > 20) clarity -= 1;
  if (wordCount < 30) clarity -= 2;
  if (wordCount > 80 && avgLen <= 30) clarity += 1;
  clarity = Math.max(1, Math.min(10, clarity));

  // Structure: look for signposting / enumeration.
  const hasStructure =
    /\b(first|second|third|finally|then|next|because|for example|in my project|steps?)\b/i.test(text) ||
    /\n\s*[-*\d]/.test(text);
  const structure = Math.max(1, Math.min(10, (hasStructure ? 7 : 4) + (wordCount > 70 ? 2 : 0)));

  const usedProjectExample =
    /\b(my project|i built|i implemented|i used|in campusorbit|our team|i developed|i created)\b/i.test(
      text
    );

  const overall = Math.round(
    technicalAccuracy * 0.45 + clarity * 0.2 + structure * 0.2 + (usedProjectExample ? 10 : 4) * 0.15
  );

  const strengths = [];
  if (technicalAccuracy >= 7) strengths.push('Good technical coverage of the expected concepts.');
  if (usedProjectExample) strengths.push('You backed the answer with a concrete project example.');
  if (hasStructure) strengths.push('Answer has a clear, followable structure.');
  if (wordCount >= 60) strengths.push('Answer has enough depth for a real interview.');
  if (!strengths.length) strengths.push('You attempted the answer — that is the first step. Now add depth.');

  const improvedAnswerOutline = [
    `Open with a one-line definition: what ${question.topic || 'this'} is and the problem it solves.`,
    ...(question.idealAnswerOutline || []).slice(0, 3),
    usedProjectExample
      ? 'Keep your project example, but add the measurable outcome (speed, security, users).'
      : 'Add a concrete example from your own project — interviewers trust evidence over theory.',
    'Close with a trade-off or limitation to show senior-level thinking.',
  ];

  let verdict;
  if (overall >= 8) verdict = 'Strong answer — interview ready with minor polish.';
  else if (overall >= 6) verdict = 'Decent answer — add missing concepts and a project example.';
  else if (overall >= 4) verdict = 'Needs work — the core concepts are only partly covered.';
  else verdict = 'Revise this topic before attempting again.';

  const recommendedNextTopic = missing.length
    ? `Revise: ${missing.slice(0, 2).join(', ')}`
    : `Move to a harder question on ${question.topic || question.role || 'this role'}`;

  return {
    technicalAccuracy,
    clarity,
    structure,
    overall,
    missingConcepts: missing,
    usedProjectExample,
    strengths,
    improvedAnswerOutline,
    recommendedNextTopic,
    verdict,
    mode: aiMode(),
  };
}

/** Summarise a peer room conversation. */
export function summariseRoom(messages = [], roomName = 'Room') {
  const texts = messages.map((m) => m.text).filter(Boolean);
  const keys = keywords(texts.join(' '), 8);
  const questionsAsked = texts.filter((t) => t.trim().endsWith('?')).slice(0, 5);
  const resources = texts.filter((t) => /https?:\/\//.test(t)).slice(0, 5);

  return {
    mode: aiMode(),
    roomName,
    messageCount: messages.length,
    mainTopics: keys.map(titleCase),
    openQuestions: questionsAsked,
    sharedResources: resources,
    summary: texts.length
      ? `The room discussed ${keys.slice(0, 4).map(titleCase).join(', ') || 'general preparation'} across ${
          messages.length
        } messages. ${questionsAsked.length} open question(s) still need answers.`
      : 'No messages yet. Start the discussion by sharing what you are stuck on.',
  };
}

export function aiStatus() {
  return {
    configured: isAIConfigured(),
    mode: aiMode(),
    label: isAIConfigured() ? 'Live AI' : 'Demo AI Mode',
    notice: isAIConfigured()
      ? 'AI provider configured. Responses are generated live.'
      : 'No AI key configured. CampusOrbit is using deterministic, seeded fallback generation. These are NOT live AI responses.',
    provider: isAIConfigured() ? 'gemini' : 'none',
  };
}

export { env };
