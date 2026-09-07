import mongoose from 'mongoose';

export const RESUME_TEMPLATES = ['orbit-modern', 'ats-minimal', 'developer-grid', 'academic-focus'];

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, default: 'My Resume' },
    template: { type: String, enum: RESUME_TEMPLATES, default: 'orbit-modern' },
    accentColor: { type: String, default: '#7c5cff' },
    isDefault: { type: Boolean, default: false },
    personal: {
      fullName: { type: String, default: '' },
      title: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      portfolio: { type: String, default: '' },
    },
    summary: { type: String, default: '' },
    education: [
      {
        institution: String,
        degree: String,
        field: String,
        startYear: String,
        endYear: String,
        score: String,
        _id: false,
      },
    ],
    skills: [
      {
        category: String,
        items: [String],
        _id: false,
      },
    ],
    projects: [
      {
        name: String,
        description: String,
        techStack: [String],
        repoUrl: String,
        liveUrl: String,
        highlights: [String],
        _id: false,
      },
    ],
    experience: [
      {
        company: String,
        role: String,
        startDate: String,
        endDate: String,
        description: String,
        highlights: [String],
        _id: false,
      },
    ],
    internships: [
      {
        company: String,
        role: String,
        duration: String,
        description: String,
        _id: false,
      },
    ],
    certificates: [
      { name: String, issuer: String, year: String, url: String, _id: false },
    ],
    achievements: { type: [String], default: [] },
    codingProfiles: [
      { platform: String, url: String, rating: String, _id: false },
    ],
    languages: { type: [String], default: [] },
    links: [{ label: String, url: String, _id: false }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

/** Resume completeness score with explainable checks. */
resumeSchema.methods.completeness = function completeness() {
  const checks = [
    Boolean(this.personal?.fullName),
    Boolean(this.personal?.email),
    Boolean(this.personal?.phone),
    Boolean(this.personal?.github || this.personal?.linkedin),
    Boolean(this.summary && this.summary.length > 40),
    (this.education || []).length > 0,
    (this.skills || []).length > 0,
    (this.projects || []).length >= 2,
    (this.experience || []).length + (this.internships || []).length > 0,
    (this.certificates || []).length > 0 || (this.achievements || []).length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
};

resumeSchema.virtual('completenessScore').get(function score() {
  return this.completeness();
});

export default mongoose.model('Resume', resumeSchema);
