import mongoose from 'mongoose';

const eligibilitySchema = new mongoose.Schema(
  {
    minCgpa: { type: Number, default: 0 },
    allowedBranches: { type: [String], default: [] },
    allowedGraduationYears: { type: [Number], default: [] },
    maxBacklogs: { type: Number, default: 99 },
  },
  { _id: false }
);

const roundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 1 },
  },
  { _id: false }
);

const opportunitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, index: 'text' },
    company: { type: String, required: true },
    companyLogoText: { type: String, default: '' },
    type: {
      type: String,
      enum: ['placement', 'internship', 'hackathon', 'scholarship', 'exam'],
      default: 'placement',
      index: true,
    },
    role: { type: String, default: '' },
    location: { type: String, default: 'Remote' },
    workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },
    description: { type: String, default: '' },
    responsibilities: { type: [String], default: [] },
    skillsRequired: { type: [String], default: [] },
    stipendOrCtc: { type: String, default: '' },
    deadline: { type: Date, required: true, index: true },
    driveDate: { type: Date, default: null },
    eligibility: { type: eligibilitySchema, default: () => ({}) },
    requiredDocuments: { type: [String], default: ['Resume'] },
    rounds: { type: [roundSchema], default: [] },
    officialLink: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published', 'expired', 'closed'],
      default: 'draft',
      index: true,
    },
    seatsAvailable: { type: Number, default: 0 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

opportunitySchema.virtual('isExpired').get(function isExpired() {
  return this.deadline ? new Date(this.deadline).getTime() < Date.now() : false;
});

export default mongoose.model('Opportunity', opportunitySchema);
