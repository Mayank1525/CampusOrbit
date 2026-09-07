/**
 * Explainable, rule-based eligibility engine.
 * Rules shape: { minCgpa, allowedBranches, allowedGraduationYears, maxBacklogs }
 * Returns human-readable reasons for both pass and fail so students understand WHY.
 */
export function checkEligibility(user, opportunity) {
  const rules = opportunity?.eligibility || {};
  const p = user?.profile || {};
  const checks = [];

  // CGPA
  if (rules.minCgpa && rules.minCgpa > 0) {
    const value = typeof p.cgpa === 'number' ? p.cgpa : null;
    const pass = value !== null && value >= rules.minCgpa;
    checks.push({
      rule: 'Minimum CGPA',
      required: `${rules.minCgpa}`,
      yours: value === null ? 'not set' : `${value}`,
      pass,
      message: pass
        ? `CGPA ${value} meets the minimum of ${rules.minCgpa}.`
        : value === null
          ? `Add your CGPA to your profile (minimum required: ${rules.minCgpa}).`
          : `CGPA ${value} is below the required ${rules.minCgpa}.`,
    });
  }

  // Branch
  if (Array.isArray(rules.allowedBranches) && rules.allowedBranches.length) {
    const value = p.branch || '';
    const pass = rules.allowedBranches
      .map((b) => b.toLowerCase())
      .includes(value.toLowerCase());
    checks.push({
      rule: 'Branch',
      required: rules.allowedBranches.join(', '),
      yours: value || 'not set',
      pass,
      message: pass
        ? `Branch ${value} is eligible.`
        : `This drive is open to ${rules.allowedBranches.join(', ')}${value ? `, not ${value}` : ''}.`,
    });
  }

  // Graduation year
  if (Array.isArray(rules.allowedGraduationYears) && rules.allowedGraduationYears.length) {
    const value = p.graduationYear || null;
    const pass = value !== null && rules.allowedGraduationYears.includes(value);
    checks.push({
      rule: 'Graduation year',
      required: rules.allowedGraduationYears.join(', '),
      yours: value ? `${value}` : 'not set',
      pass,
      message: pass
        ? `Graduation year ${value} is eligible.`
        : `Only ${rules.allowedGraduationYears.join(', ')} batches can apply.`,
    });
  }

  // Backlogs
  if (rules.maxBacklogs !== undefined && rules.maxBacklogs !== null && rules.maxBacklogs < 99) {
    const value = typeof p.backlogCount === 'number' ? p.backlogCount : 0;
    const pass = value <= rules.maxBacklogs;
    checks.push({
      rule: 'Backlogs',
      required: `at most ${rules.maxBacklogs}`,
      yours: `${value}`,
      pass,
      message: pass
        ? `${value} backlog(s) is within the allowed limit.`
        : `Maximum ${rules.maxBacklogs} backlog(s) allowed, you have ${value}.`,
    });
  }

  const eligible = checks.every((c) => c.pass);
  const reasons = checks.filter((c) => !c.pass).map((c) => c.message);

  return { eligible, checks, reasons };
}

/** Document checklist for an opportunity based on the student's wallet + profile. */
export function buildDocumentChecklist(user, opportunity, documents = [], resumes = []) {
  const required = opportunity?.requiredDocuments?.length
    ? opportunity.requiredDocuments
    : ['Resume'];

  const has = (category) => documents.some((d) => d.category === category);
  const p = user?.profile || {};

  return required.map((label) => {
    const key = label.toLowerCase();
    let satisfied = false;
    if (key.includes('resume')) satisfied = resumes.length > 0;
    else if (key.includes('github')) satisfied = Boolean(p.githubUrl);
    else if (key.includes('portfolio')) satisfied = Boolean(p.portfolioUrl);
    else if (key.includes('linkedin')) satisfied = Boolean(p.linkedinUrl);
    else if (key.includes('project')) satisfied = has('project-link');
    else if (key.includes('transcript') || key.includes('marksheet')) satisfied = has('marksheet');
    else if (key.includes('certificate')) satisfied = has('certificate');
    else if (key.includes('photo')) satisfied = has('photo');
    else if (key.includes('id')) satisfied = has('government-id');
    else if (key.includes('coding')) satisfied = Boolean(p.codingProfileUrl) || has('coding-profile');
    else satisfied = has('other');
    return { label, satisfied };
  });
}

/** Score how well an opportunity matches a student (explainable, 0-100). */
export function matchScore(user, opportunity) {
  const p = user?.profile || {};
  const skills = (p.skills || []).map((s) => s.toLowerCase());
  const required = (opportunity.skillsRequired || []).map((s) => s.toLowerCase());
  const overlap = required.filter((s) => skills.some((k) => k.includes(s) || s.includes(k)));

  const skillPart = required.length ? (overlap.length / required.length) * 60 : 30;
  const { eligible } = checkEligibility(user, opportunity);
  const eligiblePart = eligible ? 30 : 0;
  const goalTags = (p.careerGoals || []).map((g) => g.toLowerCase());
  const goalHit = goalTags.some(
    (g) =>
      (opportunity.role || '').toLowerCase().includes(g) ||
      (opportunity.tags || []).some((t) => t.toLowerCase().includes(g))
  );
  const goalPart = goalHit ? 10 : 0;

  return {
    score: Math.round(skillPart + eligiblePart + goalPart),
    matchedSkills: overlap,
    eligible,
  };
}
