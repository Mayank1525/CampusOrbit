import { forwardRef } from 'react';
import {
  Mail, Phone, MapPin, Github, Linkedin, Globe, Link as LinkIcon, Award, Star,
} from 'lucide-react';

/**
 * Four print-ready resume templates.
 * All render into a fixed A4-ratio page so the on-screen preview matches the PDF.
 * Everything is inline-styled where colour depends on accentColor so html2canvas
 * / jsPDF captures it faithfully.
 */

const A4 = { width: 794, minHeight: 1123 }; // 96dpi A4

function Contact({ personal, color, compact }) {
  const items = [
    personal.email && { icon: Mail, text: personal.email },
    personal.phone && { icon: Phone, text: personal.phone },
    personal.location && { icon: MapPin, text: personal.location },
    personal.github && { icon: Github, text: personal.github.replace(/^https?:\/\/(www\.)?/, '') },
    personal.linkedin && { icon: Linkedin, text: personal.linkedin.replace(/^https?:\/\/(www\.)?/, '') },
    personal.portfolio && { icon: Globe, text: personal.portfolio.replace(/^https?:\/\/(www\.)?/, '') },
  ].filter(Boolean);

  return (
    <div className={`flex flex-wrap ${compact ? 'gap-x-3 gap-y-1' : 'gap-x-4 gap-y-1.5'}`}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: compact ? '#374151' : undefined }}>
          <it.icon size={10} style={{ color }} />
          {it.text}
        </span>
      ))}
    </div>
  );
}

/* =============================================================== 1. ORBIT MODERN */
function OrbitModern({ data, color }) {
  const p = data.personal || {};
  return (
    <div style={{ ...A4, background: '#ffffff', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* header band */}
      <div style={{ background: `linear-gradient(120deg, ${color}, ${color}bb)`, padding: '30px 40px 26px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {p.fullName || 'Your Name'}
        </h1>
        {p.title && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 5, fontWeight: 500 }}>{p.title}</p>
        )}
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.95)' }}>
          <Contact personal={p} color="rgba(255,255,255,0.95)" />
        </div>
      </div>

      <div style={{ padding: '24px 40px 40px' }}>
        {data.summary && (
          <Section title="Profile" color={color}>
            <p style={{ fontSize: 11.5, lineHeight: 1.65, color: '#374151' }}>{data.summary}</p>
          </Section>
        )}

        {data.skills?.length > 0 && (
          <Section title="Skills" color={color}>
            {data.skills.map((g, i) => (
              <div key={i} style={{ marginBottom: 7 }}>
                {g.category && (
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{g.category}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(g.items || []).map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: 10,
                        padding: '2.5px 8px',
                        borderRadius: 99,
                        background: `${color}14`,
                        color: color,
                        border: `1px solid ${color}33`,
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        )}

        {data.projects?.length > 0 && (
          <Section title="Projects" color={color}>
            {data.projects.map((pr, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{pr.name}</p>
                  {(pr.repoUrl || pr.liveUrl) && (
                    <p style={{ fontSize: 9.5, color: color }}>
                      {(pr.liveUrl || pr.repoUrl || '').replace(/^https?:\/\/(www\.)?/, '')}
                    </p>
                  )}
                </div>
                {pr.description && (
                  <p style={{ fontSize: 11, lineHeight: 1.55, color: '#4b5563', marginTop: 2 }}>{pr.description}</p>
                )}
                {pr.highlights?.length > 0 && (
                  <ul style={{ marginTop: 4, paddingLeft: 14 }}>
                    {pr.highlights.map((h, hi) => (
                      <li key={hi} style={{ fontSize: 10.5, lineHeight: 1.55, color: '#4b5563', listStyle: 'disc' }}>{h}</li>
                    ))}
                  </ul>
                )}
                {pr.techStack?.length > 0 && (
                  <p style={{ fontSize: 9.5, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
                    {pr.techStack.join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {(data.experience?.length > 0 || data.internships?.length > 0) && (
          <Section title="Experience" color={color}>
            {[...(data.experience || []), ...(data.internships || [])].map((e, i) => (
              <div key={i} style={{ marginBottom: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                    {e.role} {e.company ? `· ${e.company}` : ''}
                  </p>
                  <p style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {e.duration || [e.startDate, e.endDate].filter(Boolean).join(' – ')}
                  </p>
                </div>
                {e.description && (
                  <p style={{ fontSize: 11, lineHeight: 1.55, color: '#4b5563', marginTop: 2 }}>{e.description}</p>
                )}
                {e.highlights?.length > 0 && (
                  <ul style={{ marginTop: 3, paddingLeft: 14 }}>
                    {e.highlights.map((h, hi) => (
                      <li key={hi} style={{ fontSize: 10.5, lineHeight: 1.55, color: '#4b5563', listStyle: 'disc' }}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Section>
        )}

        {data.education?.length > 0 && (
          <Section title="Education" color={color}>
            {data.education.map((ed, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>
                    {ed.degree}{ed.field ? `, ${ed.field}` : ''}
                  </p>
                  <p style={{ fontSize: 10.5, color: '#4b5563' }}>{ed.institution}</p>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <p style={{ fontSize: 10, color: '#6b7280' }}>
                    {[ed.startYear, ed.endYear].filter(Boolean).join(' – ')}
                  </p>
                  {ed.score && <p style={{ fontSize: 10, fontWeight: 600, color }}>{ed.score}</p>}
                </div>
              </div>
            ))}
          </Section>
        )}

        <TwoCol data={data} color={color} />
      </div>
    </div>
  );
}

/* ============================================================== 2. ATS MINIMAL */
function ATSMinimal({ data, color }) {
  const p = data.personal || {};
  const H = ({ children }) => (
    <h2
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        color: '#111827',
        borderBottom: '1px solid #d1d5db',
        paddingBottom: 3,
        marginBottom: 8,
        marginTop: 16,
      }}
    >
      {children}
    </h2>
  );

  return (
    <div
      style={{
        ...A4,
        background: '#ffffff',
        color: '#111827',
        fontFamily: 'Georgia, "Times New Roman", serif',
        padding: '46px 54px',
      }}
    >
      <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: 12 }}>
        <h1 style={{ fontSize: 25, fontWeight: 700, letterSpacing: '0.02em' }}>{p.fullName || 'Your Name'}</h1>
        {p.title && <p style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>{p.title}</p>}
        <p style={{ fontSize: 10.5, color: '#374151', marginTop: 7, lineHeight: 1.6 }}>
          {[p.email, p.phone, p.location].filter(Boolean).join('  |  ')}
        </p>
        <p style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
          {[p.github, p.linkedin, p.portfolio]
            .filter(Boolean)
            .map((u) => u.replace(/^https?:\/\/(www\.)?/, ''))
            .join('  |  ')}
        </p>
      </div>

      {data.summary && (
        <>
          <H>Professional Summary</H>
          <p style={{ fontSize: 11, lineHeight: 1.65, color: '#1f2937', textAlign: 'justify' }}>{data.summary}</p>
        </>
      )}

      {data.education?.length > 0 && (
        <>
          <H>Education</H>
          {data.education.map((ed, i) => (
            <div key={i} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700 }}>{ed.institution}</p>
                <p style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
                  {[ed.startYear, ed.endYear].filter(Boolean).join(' – ')}
                </p>
              </div>
              <p style={{ fontSize: 11, color: '#374151' }}>
                {ed.degree}{ed.field ? `, ${ed.field}` : ''}{ed.score ? ` — ${ed.score}` : ''}
              </p>
            </div>
          ))}
        </>
      )}

      {data.skills?.length > 0 && (
        <>
          <H>Technical Skills</H>
          {data.skills.map((g, i) => (
            <p key={i} style={{ fontSize: 11, lineHeight: 1.7, color: '#1f2937' }}>
              {g.category && <strong>{g.category}: </strong>}
              {(g.items || []).join(', ')}
            </p>
          ))}
        </>
      )}

      {(data.experience?.length > 0 || data.internships?.length > 0) && (
        <>
          <H>Experience</H>
          {[...(data.experience || []), ...(data.internships || [])].map((e, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700 }}>{e.role}</p>
                <p style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
                  {e.duration || [e.startDate, e.endDate].filter(Boolean).join(' – ')}
                </p>
              </div>
              <p style={{ fontSize: 11, fontStyle: 'italic', color: '#374151' }}>{e.company}</p>
              {e.description && (
                <p style={{ fontSize: 10.5, lineHeight: 1.6, color: '#1f2937', marginTop: 2 }}>{e.description}</p>
              )}
              {e.highlights?.length > 0 && (
                <ul style={{ paddingLeft: 16, marginTop: 3 }}>
                  {e.highlights.map((h, hi) => (
                    <li key={hi} style={{ fontSize: 10.5, lineHeight: 1.6, listStyle: 'disc' }}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {data.projects?.length > 0 && (
        <>
          <H>Projects</H>
          {data.projects.map((pr, i) => (
            <div key={i} style={{ marginBottom: 9 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700 }}>
                {pr.name}
                {pr.techStack?.length > 0 && (
                  <span style={{ fontWeight: 400, fontStyle: 'italic', fontSize: 10.5 }}>
                    {' '}— {pr.techStack.join(', ')}
                  </span>
                )}
              </p>
              {pr.description && (
                <p style={{ fontSize: 10.5, lineHeight: 1.6, color: '#1f2937' }}>{pr.description}</p>
              )}
              {pr.highlights?.length > 0 && (
                <ul style={{ paddingLeft: 16, marginTop: 2 }}>
                  {pr.highlights.map((h, hi) => (
                    <li key={hi} style={{ fontSize: 10.5, lineHeight: 1.6, listStyle: 'disc' }}>{h}</li>
                  ))}
                </ul>
              )}
              {(pr.repoUrl || pr.liveUrl) && (
                <p style={{ fontSize: 10, color: '#374151' }}>{pr.repoUrl || pr.liveUrl}</p>
              )}
            </div>
          ))}
        </>
      )}

      {data.certificates?.length > 0 && (
        <>
          <H>Certifications</H>
          <ul style={{ paddingLeft: 16 }}>
            {data.certificates.map((c, i) => (
              <li key={i} style={{ fontSize: 10.5, lineHeight: 1.7, listStyle: 'disc' }}>
                {c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
              </li>
            ))}
          </ul>
        </>
      )}

      {data.achievements?.length > 0 && (
        <>
          <H>Achievements</H>
          <ul style={{ paddingLeft: 16 }}>
            {data.achievements.map((a, i) => (
              <li key={i} style={{ fontSize: 10.5, lineHeight: 1.7, listStyle: 'disc' }}>{a}</li>
            ))}
          </ul>
        </>
      )}

      {data.codingProfiles?.length > 0 && (
        <>
          <H>Coding Profiles</H>
          <p style={{ fontSize: 10.5, lineHeight: 1.7 }}>
            {data.codingProfiles
              .map((c) => `${c.platform}${c.rating ? ` (${c.rating})` : ''}: ${c.url}`)
              .join('  |  ')}
          </p>
        </>
      )}
    </div>
  );
}

/* ============================================================ 3. DEVELOPER GRID */
function DeveloperGrid({ data, color }) {
  const p = data.personal || {};
  const SideH = ({ children }) => (
    <h2
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.13em',
        color: color,
        marginBottom: 7,
        marginTop: 16,
      }}
    >
      {children}
    </h2>
  );
  const MainH = ({ children }) => (
    <h2
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: 9,
        marginTop: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ width: 14, height: 2.5, background: color, borderRadius: 2 }} />
      {children}
    </h2>
  );

  return (
    <div
      style={{
        ...A4,
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        display: 'flex',
      }}
    >
      {/* sidebar */}
      <div style={{ width: 244, background: '#0f172a', color: '#e2e8f0', padding: '34px 22px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          {p.fullName || 'Your Name'}
        </h1>
        {p.title && <p style={{ fontSize: 10.5, color, marginTop: 5, fontWeight: 600 }}>{p.title}</p>}

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            p.email && { icon: Mail, t: p.email },
            p.phone && { icon: Phone, t: p.phone },
            p.location && { icon: MapPin, t: p.location },
            p.github && { icon: Github, t: p.github.replace(/^https?:\/\/(www\.)?/, '') },
            p.linkedin && { icon: Linkedin, t: p.linkedin.replace(/^https?:\/\/(www\.)?/, '') },
            p.portfolio && { icon: Globe, t: p.portfolio.replace(/^https?:\/\/(www\.)?/, '') },
          ]
            .filter(Boolean)
            .map((it, i) => (
              <p key={i} style={{ fontSize: 9, color: '#cbd5e1', display: 'flex', gap: 6, alignItems: 'flex-start', wordBreak: 'break-all' }}>
                <it.icon size={10} style={{ color, flexShrink: 0, marginTop: 1 }} />
                {it.t}
              </p>
            ))}
        </div>

        {data.skills?.length > 0 && (
          <>
            <SideH>Stack</SideH>
            {data.skills.map((g, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                {g.category && (
                  <p style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>{g.category}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(g.items || []).map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: 8.5,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: `${color}22`,
                        color: '#e2e8f0',
                        border: `1px solid ${color}44`,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {data.codingProfiles?.length > 0 && (
          <>
            <SideH>Profiles</SideH>
            {data.codingProfiles.map((c, i) => (
              <p key={i} style={{ fontSize: 9, color: '#cbd5e1', marginBottom: 4, wordBreak: 'break-all' }}>
                <span style={{ color, fontWeight: 700 }}>{c.platform}</span>
                {c.rating ? ` · ${c.rating}` : ''}
                <br />
                <span style={{ fontSize: 8, color: '#94a3b8' }}>{(c.url || '').replace(/^https?:\/\/(www\.)?/, '')}</span>
              </p>
            ))}
          </>
        )}

        {data.education?.length > 0 && (
          <>
            <SideH>Education</SideH>
            {data.education.map((ed, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 9.5, fontWeight: 700, color: '#f1f5f9' }}>{ed.degree}</p>
                <p style={{ fontSize: 8.5, color: '#94a3b8' }}>{ed.field}</p>
                <p style={{ fontSize: 8.5, color: '#cbd5e1' }}>{ed.institution}</p>
                <p style={{ fontSize: 8, color: color }}>
                  {[ed.startYear, ed.endYear].filter(Boolean).join('–')}{ed.score ? ` · ${ed.score}` : ''}
                </p>
              </div>
            ))}
          </>
        )}

        {data.languages?.length > 0 && (
          <>
            <SideH>Languages</SideH>
            <p style={{ fontSize: 9, color: '#cbd5e1' }}>{data.languages.join(', ')}</p>
          </>
        )}
      </div>

      {/* main */}
      <div style={{ flex: 1, padding: '34px 28px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {data.summary && (
          <>
            <MainH>About</MainH>
            <p style={{ fontSize: 11, lineHeight: 1.65, color: '#334155' }}>{data.summary}</p>
          </>
        )}

        {data.projects?.length > 0 && (
          <>
            <MainH>Projects</MainH>
            {data.projects.map((pr, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 11,
                  paddingLeft: 11,
                  borderLeft: `2px solid ${color}44`,
                }}
              >
                <p style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>{pr.name}</p>
                {pr.description && (
                  <p style={{ fontSize: 10.5, lineHeight: 1.55, color: '#475569', marginTop: 2 }}>{pr.description}</p>
                )}
                {pr.highlights?.length > 0 && (
                  <ul style={{ paddingLeft: 13, marginTop: 3 }}>
                    {pr.highlights.map((h, hi) => (
                      <li key={hi} style={{ fontSize: 10, lineHeight: 1.55, color: '#475569', listStyle: 'square' }}>{h}</li>
                    ))}
                  </ul>
                )}
                {pr.techStack?.length > 0 && (
                  <p style={{ fontSize: 9, color, marginTop: 3, fontFamily: 'monospace' }}>
                    {pr.techStack.join(' / ')}
                  </p>
                )}
                {(pr.repoUrl || pr.liveUrl) && (
                  <p style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                    {(pr.repoUrl || pr.liveUrl).replace(/^https?:\/\/(www\.)?/, '')}
                  </p>
                )}
              </div>
            ))}
          </>
        )}

        {(data.experience?.length > 0 || data.internships?.length > 0) && (
          <>
            <MainH>Experience</MainH>
            {[...(data.experience || []), ...(data.internships || [])].map((e, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>{e.role}</p>
                  <p style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {e.duration || [e.startDate, e.endDate].filter(Boolean).join(' – ')}
                  </p>
                </div>
                <p style={{ fontSize: 10, color, fontWeight: 600 }}>{e.company}</p>
                {e.description && (
                  <p style={{ fontSize: 10.5, lineHeight: 1.55, color: '#475569', marginTop: 2 }}>{e.description}</p>
                )}
                {e.highlights?.length > 0 && (
                  <ul style={{ paddingLeft: 13, marginTop: 2 }}>
                    {e.highlights.map((h, hi) => (
                      <li key={hi} style={{ fontSize: 10, lineHeight: 1.55, color: '#475569', listStyle: 'square' }}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}

        {(data.achievements?.length > 0 || data.certificates?.length > 0) && (
          <>
            <MainH>Achievements & Certs</MainH>
            <ul style={{ paddingLeft: 14 }}>
              {(data.achievements || []).map((a, i) => (
                <li key={`a${i}`} style={{ fontSize: 10.5, lineHeight: 1.6, color: '#334155', listStyle: 'disc' }}>{a}</li>
              ))}
              {(data.certificates || []).map((c, i) => (
                <li key={`c${i}`} style={{ fontSize: 10.5, lineHeight: 1.6, color: '#334155', listStyle: 'disc' }}>
                  {c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================== 4. ACADEMIC FOCUS */
function AcademicFocus({ data, color }) {
  const p = data.personal || {};
  const H = ({ children }) => (
    <h2
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        color: color,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop: 17,
        marginBottom: 8,
        paddingBottom: 3,
        borderBottom: `1.5px solid ${color}55`,
      }}
    >
      {children}
    </h2>
  );

  return (
    <div
      style={{
        ...A4,
        background: '#ffffff',
        color: '#1f2937',
        fontFamily: '"Source Serif Pro", Georgia, serif',
        padding: '44px 50px',
      }}
    >
      <div style={{ borderLeft: `4px solid ${color}`, paddingLeft: 16, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1.15 }}>
          {p.fullName || 'Your Name'}
        </h1>
        {p.title && <p style={{ fontSize: 12.5, color, marginTop: 3, fontWeight: 600 }}>{p.title}</p>}
        <div style={{ marginTop: 8 }}>
          <Contact personal={p} color={color} compact />
        </div>
      </div>

      {data.summary && (
        <>
          <H>Research & Career Objective</H>
          <p style={{ fontSize: 11, lineHeight: 1.7, color: '#374151', textAlign: 'justify' }}>{data.summary}</p>
        </>
      )}

      {data.education?.length > 0 && (
        <>
          <H>Academic Background</H>
          {data.education.map((ed, i) => (
            <div key={i} style={{ marginBottom: 9, display: 'flex', gap: 12 }}>
              <div
                style={{
                  minWidth: 78,
                  fontSize: 10,
                  color,
                  fontWeight: 700,
                  paddingTop: 1,
                }}
              >
                {[ed.startYear, ed.endYear].filter(Boolean).join('–') || '—'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                  {ed.degree}{ed.field ? ` in ${ed.field}` : ''}
                </p>
                <p style={{ fontSize: 11, color: '#4b5563' }}>{ed.institution}</p>
                {ed.score && (
                  <p style={{ fontSize: 10.5, color, fontWeight: 600, marginTop: 1 }}>{ed.score}</p>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {data.achievements?.length > 0 && (
        <>
          <H>Academic Achievements</H>
          {data.achievements.map((a, i) => (
            <p key={i} style={{ fontSize: 11, lineHeight: 1.7, color: '#374151', display: 'flex', gap: 7 }}>
              <Star size={10} style={{ color, flexShrink: 0, marginTop: 4 }} />
              {a}
            </p>
          ))}
        </>
      )}

      {data.projects?.length > 0 && (
        <>
          <H>Projects & Research Work</H>
          {data.projects.map((pr, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>{pr.name}</p>
              {pr.description && (
                <p style={{ fontSize: 10.5, lineHeight: 1.65, color: '#4b5563', textAlign: 'justify' }}>
                  {pr.description}
                </p>
              )}
              {pr.highlights?.length > 0 && (
                <ul style={{ paddingLeft: 15, marginTop: 3 }}>
                  {pr.highlights.map((h, hi) => (
                    <li key={hi} style={{ fontSize: 10.5, lineHeight: 1.6, color: '#4b5563', listStyle: 'circle' }}>{h}</li>
                  ))}
                </ul>
              )}
              {pr.techStack?.length > 0 && (
                <p style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  <em>Tools: {pr.techStack.join(', ')}</em>
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {data.skills?.length > 0 && (
        <>
          <H>Technical Competencies</H>
          {data.skills.map((g, i) => (
            <p key={i} style={{ fontSize: 11, lineHeight: 1.75, color: '#374151' }}>
              {g.category && <strong style={{ color: '#111827' }}>{g.category}: </strong>}
              {(g.items || []).join(', ')}
            </p>
          ))}
        </>
      )}

      {(data.experience?.length > 0 || data.internships?.length > 0) && (
        <>
          <H>Experience</H>
          {[...(data.experience || []), ...(data.internships || [])].map((e, i) => (
            <div key={i} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>{e.role}, {e.company}</p>
                <p style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {e.duration || [e.startDate, e.endDate].filter(Boolean).join(' – ')}
                </p>
              </div>
              {e.description && (
                <p style={{ fontSize: 10.5, lineHeight: 1.65, color: '#4b5563' }}>{e.description}</p>
              )}
            </div>
          ))}
        </>
      )}

      {data.certificates?.length > 0 && (
        <>
          <H>Certifications</H>
          {data.certificates.map((c, i) => (
            <p key={i} style={{ fontSize: 11, lineHeight: 1.7, color: '#374151', display: 'flex', gap: 7 }}>
              <Award size={10} style={{ color, flexShrink: 0, marginTop: 4 }} />
              {c.name}{c.issuer ? `, ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
            </p>
          ))}
        </>
      )}

      {data.languages?.length > 0 && (
        <>
          <H>Languages</H>
          <p style={{ fontSize: 11, color: '#374151' }}>{data.languages.join(' · ')}</p>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- shared helpers */
function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <h2
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color,
          marginBottom: 8,
          paddingBottom: 3,
          borderBottom: `1.5px solid ${color}33`,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function TwoCol({ data, color }) {
  const hasCerts = data.certificates?.length > 0;
  const hasAch = data.achievements?.length > 0;
  const hasProfiles = data.codingProfiles?.length > 0;
  const hasLang = data.languages?.length > 0;
  if (!hasCerts && !hasAch && !hasProfiles && !hasLang) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        {hasAch && (
          <Section title="Achievements" color={color}>
            <ul style={{ paddingLeft: 14 }}>
              {data.achievements.map((a, i) => (
                <li key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: '#4b5563', listStyle: 'disc' }}>{a}</li>
              ))}
            </ul>
          </Section>
        )}
        {hasLang && (
          <Section title="Languages" color={color}>
            <p style={{ fontSize: 10.5, color: '#4b5563' }}>{data.languages.join(' · ')}</p>
          </Section>
        )}
      </div>
      <div>
        {hasCerts && (
          <Section title="Certifications" color={color}>
            {data.certificates.map((c, i) => (
              <p key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: '#4b5563' }}>
                <strong style={{ color: '#111827' }}>{c.name}</strong>
                {c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}
              </p>
            ))}
          </Section>
        )}
        {hasProfiles && (
          <Section title="Coding Profiles" color={color}>
            {data.codingProfiles.map((c, i) => (
              <p key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: '#4b5563' }}>
                <strong style={{ color: '#111827' }}>{c.platform}</strong>
                {c.rating ? ` · ${c.rating}` : ''}
              </p>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- registry */
export const TEMPLATE_META = {
  'orbit-modern': {
    name: 'Orbit Modern',
    description: 'Bold gradient header with skill pills. Great for product and startup roles.',
    best: 'Startups · Product companies',
  },
  'ats-minimal': {
    name: 'ATS Minimal',
    description: 'Single column, serif, zero graphics. Parses cleanly through any ATS screener.',
    best: 'Mass campus drives · Service companies',
  },
  'developer-grid': {
    name: 'Developer Grid',
    description: 'Dark sidebar with your stack and coding profiles, monospace accents.',
    best: 'SDE roles · Open-source heavy profiles',
  },
  'academic-focus': {
    name: 'Academic Focus',
    description: 'Education-first with a research tone. Puts CGPA and achievements up top.',
    best: 'GATE · MS applications · Research internships',
  },
};

const TEMPLATES = {
  'orbit-modern': OrbitModern,
  'ats-minimal': ATSMinimal,
  'developer-grid': DeveloperGrid,
  'academic-focus': AcademicFocus,
};

const ResumeRenderer = forwardRef(function ResumeRenderer({ resume, scale = 1 }, ref) {
  const Template = TEMPLATES[resume?.template] || OrbitModern;
  const color = resume?.accentColor || '#7c5cff';

  return (
    <div
      style={{
        width: A4.width * scale,
        height: 'auto',
        transformOrigin: 'top left',
      }}
    >
      <div
        ref={ref}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: A4.width,
          background: '#fff',
        }}
      >
        <Template data={resume} color={color} />
      </div>
      {/* spacer so the scaled element still occupies correct layout height */}
      <div style={{ height: 0, paddingBottom: `${(A4.minHeight * scale)}px` }} />
    </div>
  );
});

export default ResumeRenderer;
export { A4 };
