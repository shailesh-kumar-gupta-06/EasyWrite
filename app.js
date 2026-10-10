'use strict';
/* ===== 1. CONFIG & DEMO DATA ===== */
const STORE_KEY = 'easywrite_v1';
const WEIGHTS = { audience: 35, theme: 25, goals: 20, geography: 10, budget: 10 }; // single source of truth
const STATUSES = ['Researching','Ready to Contact','Contacted','Replied','Negotiating','Confirmed','Declined'];
const BENEFITS = ['Logo placement','Booth space','Social media promotion','Speaking opportunities','Workshops','Recruitment access'];
const CATEGORIES = ['Technology','Education','Cultural','Sports','Career','Social Impact'];
const GOAL_MAP = { 'Recruit talent':'Recruitment access', 'Brand awareness':'Logo placement', 'Student engagement':'Workshops', 'Product demos':'Booth space', 'Thought leadership':'Speaking opportunities', 'Social reach':'Social media promotion' };
const NOTE = 'Fit scores are heuristic estimates to help prioritize outreach. They do not predict whether a sponsor will approve a request.';
// All sponsors are FICTIONAL demo data: not verified, never contacted.
const SPONSORS = [
 {id:'s1',name:'Northwind Labs',industry:'Technology',desc:'Fictional developer-tools startup.',goals:['Recruit talent','Product demos'],audiences:['student','engineer','developer','coding','computer'],themes:['Technology','Career'],city:'Bengaluru',reach:'national',min:20000,max:150000},
 {id:'s2',name:'BrightPath Learning',industry:'Education',desc:'Fictional online-learning platform.',goals:['Student engagement','Brand awareness'],audiences:['student','learner','beginner','school','college'],themes:['Education','Technology'],city:'Delhi',reach:'national',min:10000,max:80000},
 {id:'s3',name:'Cedar Ledger',industry:'Finance',desc:'Fictional student-banking fintech.',goals:['Brand awareness','Recruit talent'],audiences:['student','finance','startup','business','young'],themes:['Career','Social Impact'],city:'Mumbai',reach:'national',min:25000,max:200000},
 {id:'s4',name:'Chai & Co. Roasters',industry:'Food & Beverage',desc:'Fictional café chain.',goals:['Social reach','Brand awareness'],audiences:['student','campus','festival','young','community'],themes:['Cultural','Sports','Social Impact'],city:'Durg',reach:'local',min:3000,max:40000},
 {id:'s5',name:'Orbit Cloud',industry:'Technology',desc:'Fictional cloud-hosting provider.',goals:['Product demos','Thought leadership'],audiences:['developer','hackathon','engineer','student','cloud'],themes:['Technology'],city:'Hyderabad',reach:'national',min:30000,max:250000},
 {id:'s6',name:'Greenleaf Stationers',industry:'Local Business',desc:'Fictional neighbourhood stationery shop.',goals:['Brand awareness','Social reach'],audiences:['student','campus','school','local'],themes:['Education','Cultural'],city:'Durg',reach:'local',min:2000,max:25000},
 {id:'s7',name:'Vertex Careers',industry:'Education',desc:'Fictional career-coaching service.',goals:['Recruit talent','Student engagement','Thought leadership'],audiences:['student','graduate','career','job','placement'],themes:['Career','Education'],city:'Pune',reach:'national',min:8000,max:90000},
 {id:'s8',name:'Sunrise Sports Nutrition',industry:'Food & Beverage',desc:'Fictional sports-drink brand.',goals:['Brand awareness','Product demos','Social reach'],audiences:['athlete','sports','fitness','student','young'],themes:['Sports','Social Impact'],city:'Raipur',reach:'regional',min:10000,max:100000},
 {id:'s9',name:'Raipur Print House',industry:'Local Business',desc:'Fictional local printing business.',goals:['Brand awareness'],audiences:['campus','student','local','community'],themes:['Cultural','Education','Sports'],city:'Raipur',reach:'local',min:1500,max:20000},
 {id:'s10',name:'PennyWise Capital',industry:'Finance',desc:'Fictional investing app.',goals:['Student engagement','Recruit talent'],audiences:['student','finance','investing','young','career'],themes:['Career','Education'],city:'Mumbai',reach:'national',min:20000,max:120000}
];
const uid = p => p + Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN');

function seed() {
  return {
    events: [{id:'e1',name:'CodeSprint 2026 (sample)',category:'Technology',description:'24-hour campus hackathon for beginner and intermediate student developers.',audience:'College students, developers, beginners',attendees:300,city:'Durg',date:addDays(45),target:100000,benefits:['Logo placement','Booth space','Social media promotion','Recruitment access']}],
    saved: ['s1','s4'], drafts: [],
    pipeline: [
      {id:'p1',sponsorId:'s1',eventId:'e1',status:'Contacted',lastContact:addDays(-6),nextAction:'Send first follow-up',followUp:addDays(-1),notes:'Sample record. Sent manually by the organiser.'},
      {id:'p2',sponsorId:'s4',eventId:'e1',status:'Ready to Contact',lastContact:'',nextAction:'Review and send draft',followUp:addDays(3),notes:''},
      {id:'p3',sponsorId:'s2',eventId:'e1',status:'Researching',lastContact:'',nextAction:'Find a contact on their website',followUp:addDays(7),notes:''}],
    activity: [{t:'Sample data loaded',d:today()}], certs: [],
    settings: {tone:'Professional',defaultEvent:'e1',view:'kanban',notify:true}
  };
}
let state = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || seed(); } catch { return seed(); } })();
state.certs = state.certs || [];
const ROLES = ['Participant','Winner','Runner-up','Volunteer','Speaker','Organiser'];
let ctx = { eventId: state.settings.defaultEvent || '', sponsorId: '', pkgId: '', channel: 'Email', draft: null, all: null, tone: state.settings.tone || 'Professional', q: '', industry: '', pq: '', ps: '' };
let page = 'overview';
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { toast('Could not save to localStorage', true); } }
function log(t) { state.activity.unshift({ t, d: today() }); state.activity = state.activity.slice(0, 20); }
const ev = id => state.events.find(e => e.id === id);
const sp = id => SPONSORS.find(s => s.id === id);

/* ===== 2. API LAYER (future FastAPI backend; none of this is called in demo mode) ===== */
const API = {
  base: 'http://localhost:8000', connected: false, gemma: false,
  async init() { try { const j = await (await fetch(this.base + '/api/health')).json(); this.connected = !!j.ok; this.gemma = !!j.gemma; } catch { this.connected = false; } },
  async request(method, path, body) {
    if (!this.connected) throw new Error('demo-mode');
    const r = await fetch(this.base + path, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  },
  createEvent: e => API.request('POST', '/api/events', e),
  getSponsorFits: id => API.request('GET', `/api/events/${id}/sponsor-fits`),
  createOutreach: (fitId, o) => API.request('POST', `/api/sponsor-fits/${fitId}/outreach`, o),
  saveProspect: r => API.request('POST', '/api/prospects', r),
  createCerts: (eventId, o) => API.request('POST', `/api/events/${eventId}/certificates`, o),
  saveCert: c => API.request('POST', '/api/certificates', c),
  remove: path => API.request('DELETE', path),
  updateProspect: (id, patch) => API.request('PATCH', `/api/prospects/${id}`, patch)
};

/* ===== 3. SCORING ===== */
function scoreFit(event, s) {
  const text = `${event.audience} ${event.description} ${event.name}`.toLowerCase();
  const parts = [], missing = [];
  // Audience
  let m = s.audiences.filter(k => text.includes(k)).length, p = 0;
  if (!event.audience.trim()) missing.push('Target audience not provided');
  else p = Math.round(WEIGHTS.audience * Math.min(1, m / 3));
  parts.push({label:'Audience alignment',pts:p,max:WEIGHTS.audience,why:`${m} of the sponsor's audience keywords appear in the event text.`});
  // Theme
  p = s.themes.includes(event.category) ? WEIGHTS.theme : (s.themes.some(t => text.includes(t.toLowerCase())) ? Math.round(WEIGHTS.theme * .4) : 0);
  parts.push({label:'Event/theme alignment',pts:p,max:WEIGHTS.theme,why:s.themes.includes(event.category) ? `"${event.category}" matches a sponsor theme.` : 'Category is not a listed theme for this sponsor.'});
  // Goals
  const wanted = s.goals.map(g => GOAL_MAP[g]), hit = wanted.filter(b => event.benefits.includes(b)).length;
  if (!event.benefits.length) missing.push('No sponsorship benefits selected');
  p = Math.round(WEIGHTS.goals * hit / s.goals.length);
  parts.push({label:'Sponsor goal match',pts:p,max:WEIGHTS.goals,why:`${hit} of ${s.goals.length} sponsor goals map to benefits you can offer.`});
  // Geography
  const c = event.city.trim().toLowerCase();
  if (!c) missing.push('Event city not provided');
  p = !c ? 0 : s.city.toLowerCase() === c ? WEIGHTS.geography : s.reach === 'national' ? 6 : s.reach === 'regional' ? 4 : 1;
  parts.push({label:'Geography/relationship',pts:p,max:WEIGHTS.geography,why:!c ? 'Cannot assess without a city.' : s.city.toLowerCase() === c ? 'Sponsor is based in the same city.' : `Sponsor operates at a ${s.reach} level (based in ${s.city}).`});
  // Budget
  const t = Number(event.target);
  if (!t) missing.push('Funding target not provided');
  p = !t ? 0 : t <= s.max ? WEIGHTS.budget : t <= s.max * 1.5 ? 5 : 0;
  parts.push({label:'Budget feasibility',pts:p,max:WEIGHTS.budget,why:!t ? 'Cannot assess without a funding target.' : `Demo budget range ${inr(s.min)}–${inr(s.max)} vs. your target ${inr(t)}.`});
  missing.push('Sponsor contact and past sponsorship history are unknown');
  return { total: parts.reduce((a, x) => a + x.pts, 0), parts, missing };
}
const fitFor = (eid, sid) => ev(eid) ? scoreFit(ev(eid), sp(sid)) : null;

/* ===== 4. PACKAGES & OUTREACH TEMPLATES (replace `generateOutreach` with API.createOutreach later) ===== */
function buildPackages(event, s) {
  const t = Number(event.target) || 50000, cap = s.max, b = event.benefits;
  const rng = (a, z) => { const lo = Math.max(s.min, Math.round(t * a / 1000) * 1000), hi = Math.max(lo, Math.min(cap, Math.round(t * z / 1000) * 1000)); return [lo, hi]; };
  const wanted = s.goals.map(g => GOAL_MAP[g]).filter(x => b.includes(x));
  const why = lvl => `Sponsor goals (${s.goals.join(', ')}) ${wanted.length ? 'line up with: ' + wanted.join(', ') : 'do not clearly match your listed benefits'}. ${lvl}`;
  return [
    {id:'community',name:'Community Partner',range:rng(.03,.1),benefits:b.slice(0,2),why:why('A lighter commitment to start the relationship.')},
    {id:'supporting',name:'Supporting Sponsor',range:rng(.15,.3),benefits:b.slice(0,4),why:why('Balanced visibility for the support requested.')},
    {id:'title',name:'Title Sponsor',range:rng(.4,.7),benefits:b.slice(),why:why(`Full visibility across ~${event.attendees || 'an estimated number of'} attendees.`)}
  ];
}
const pkgText = p => p ? `${p.name} (${inr(p.range[0])}–${inr(p.range[1])}, demo estimate)` : 'a sponsorship package';
function currentPkg() {
  const e = ev(ctx.eventId), s = sp(ctx.sponsorId); if (!e || !s) return null;
  const p = buildPackages(e, s).find(x => x.id === ctx.pkgId); if (!p) return null;
  return Object.assign(p, state.custom?.[`${e.id}:${s.id}:${p.id}`] || {});
}
function generateOutreach(e, s, pkg, channel, tone) {
  const g = { Professional:['Dear Partnerships Team,','Thank you for your time.','Best regards,'], Friendly:['Hi there,','Thanks so much for reading!','Warm wishes,'], Persuasive:['Hello,','We would love to build something memorable together.','With appreciation,'] }[tone];
  const ben = (pkg?.benefits.length ? pkg.benefits : e.benefits).map(x => '• ' + x).join('\n') || '• Details to be discussed';
  const val = `We noticed ${s.name} works in ${s.industry.toLowerCase()}. Our event may be relevant to your stated focus on ${s.goals.join(' and ').toLowerCase()}.`;
  const when = e.date ? ` on ${e.date}` : '', where = e.city ? ` in ${e.city}` : '';
  const ask = `We would like to invite ${s.name} to consider ${pkgText(pkg)}.`;
  const out = { subject: `Partnership opportunity: ${e.name}`, linkedin: '', whatsapp: '', follow1: '', follow2: '' };
  out.email = `${g[0]}\n\nWe are organising ${e.name}, a ${e.category.toLowerCase()} event${where}${when}${e.attendees ? ` with an expected ${e.attendees} attendees` : ''}. ${e.description}\n\n${val}\n\n${ask}\n\nBenefits we can offer:\n${ben}\n\nWould you be open to a short conversation or reviewing a one-page proposal? ${g[1]}\n\n${g[2]}\n[Your name]\n[Your club]`;
  out.linkedin = `Hello! I'm helping organise ${e.name}${where}. We're exploring partners and thought ${s.name} might be a relevant fit. Could I share a short sponsorship overview?`;
  out.whatsapp = `Hi! This is [your name] from [your club]. We're organising ${e.name}${when}. Would you be open to hearing about sponsorship options?`;
  out.follow1 = `Subject: Following up on ${e.name}\n\n${g[0]}\n\nI wanted to follow up on my earlier note about ${e.name}. Happy to share more details or adjust ${pkgText(pkg)} to suit ${s.name}.\n\n${g[2]}\n[Your name]`;
  out.follow2 = `Subject: Final note on ${e.name}\n\n${g[0]}\n\nThis is a final follow-up about ${e.name}. If the timing isn't right, no problem at all, and thank you for considering it.\n\n${g[2]}\n[Your name]`;
  return out;
}

/* ===== 5. UI HELPERS ===== */
const ICONS = {overview:'M3 11l9-8 9 8M5 10v10h14V10',events:'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',find:'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',packages:'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',outreach:'M3 5h18v14H3zM3 6l9 7 9-7',pipeline:'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v6h-4z',saved:'M6 3h12v18l-6-4-6 4z',details:'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',certificates:'M12 14a5 5 0 100-10 5 5 0 000 10zM8.5 13.5L7 21l5-3 5 3-1.5-7.5',settings:'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 1-2-1-1-2H9L8 7 6 8 4 7l-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z'};
const PAGES = [['overview','Overview'],['events','My Events'],['details','Event Details'],['find','Find Sponsors'],['packages','Sponsorship Packages'],['outreach','Outreach Studio'],['pipeline','Sponsor Pipeline'],['certificates','Certificates'],['saved','Saved Sponsors'],['settings','Settings']];
function toast(msg, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 2800); }
const $ = (q, r = document) => r.querySelector(q);
function modal(html) { $('#modalRoot').innerHTML = `<div class="back" data-a="backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; }
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmBox(msg, onYes) { modal(`<h3>Please confirm</h3><p class="mt">${esc(msg)}</p><div class="row mt"><button class="btn danger" data-a="confirmYes">Yes, continue</button><button class="btn" data-a="closeModal">Cancel</button></div>`); confirmBox.cb = onYes; }
const opts = (arr, sel, ph) => (ph ? `<option value="">${ph}</option>` : '') + arr.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
const eventOpts = sel => opts(state.events.map(e => [e.id, e.name]), sel, 'Select event');
const sponsorOpts = sel => opts(SPONSORS.map(s => [s.id, s.name]), sel, 'Select sponsor');
const isSaved = id => state.saved.includes(id);
const pill = s => `<span class="pill ${s === 'Confirmed' ? 'g' : s === 'Declined' ? 'r' : s === 'Researching' ? 'y' : ''}">${esc(s)}</span>`;
const overdue = r => r.followUp && r.followUp < today() && !['Confirmed','Declined'].includes(r.status);
const scoreDial = v => `<div class="score" style="--p:${v}" data-v="${v}" aria-label="Fit score ${v} of 100"></div>`;
const empty = (t, a) => `<div class="empty card"><p>${t}</p>${a || ''}</div>`;

/* ===== 6. VIEWS ===== */
const views = {
  overview() {
    const conf = state.pipeline.filter(r => r.status === 'Confirmed').length, due = state.pipeline.filter(overdue);
    const upcoming = state.pipeline.filter(r => r.followUp && !['Confirmed','Declined'].includes(r.status)).sort((a, b) => a.followUp.localeCompare(b.followUp)).slice(0, 5);
    const pct = state.pipeline.length ? Math.round(state.pipeline.filter(r => ['Contacted','Replied','Negotiating','Confirmed'].includes(r.status)).length / state.pipeline.length * 100) : 0;
    const stats = [['Total events',state.events.length],['Sponsors shortlisted',state.saved.length],['Outreach drafts',state.drafts.length],['Confirmed sponsors',conf],['Follow-ups due',due.length]];
    return `<div class="card hero"><h2>Let's find the right sponsors for your next event.</h2><p class="mute">Sample data is shown for demonstration. Nothing here is real or has been sent.</p><div class="row mt"><button class="btn pri" data-a="go" data-p="events">Create Event</button><button class="btn" data-a="go" data-p="find">Explore Sponsors</button></div></div>
    <div class="grid g5 mt">${stats.map(([l, v]) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <div class="card mt"><div class="row between"><b>Workflow</b><span class="sm mute">Sample data</span></div><div class="steps mt">${['Event Brief','Sponsor Fit','Package','Outreach','Pipeline'].map((s, i) => `<span>${i + 1}. ${s}</span>`).join('')}</div></div>
    <div class="card mt"><div class="row between"><b>Sponsorship progress</b><span class="sm">${pct}% of pipeline contacted or further</span></div><div class="bar mt"><i style="width:${pct}%"></i></div></div>
    <div class="grid g2 mt"><div class="card"><b>Recent activity</b><div class="list mt">${state.activity.slice(0, 5).map(a => `<div>${esc(a.t)} <span class="mute sm">· ${a.d}</span></div>`).join('') || '<p class="mute">No activity yet.</p>'}</div></div>
    <div class="card"><b>Upcoming follow-ups</b><div class="list mt">${upcoming.map(r => `<div class="row between"><span>${esc(sp(r.sponsorId)?.name)}</span><span class="${overdue(r) ? 'pill r' : 'mute sm'}">${overdue(r) ? 'Overdue · ' : ''}${r.followUp}</span></div>`).join('') || '<p class="mute">Nothing scheduled.</p>'}</div></div></div>`;
  },
  events() {
    return `<div class="split"><div class="card"><h3 id="formTitle">Create event</h3><p class="sm mute">Auto-extraction from a brief with Gemma 4 will be added once a backend is connected. For now, fill the form manually.</p>${eventForm()}</div>
    <div><h3>Your events</h3>${state.events.length ? state.events.map(e => `<div class="card mt"><div class="row between"><b>${esc(e.name)}</b><span class="pill">${esc(e.category)}</span></div><p class="sm mute mt">${esc(e.description)}</p><p class="sm mt">${esc(e.city)} · ${esc(e.date)} · ${esc(e.attendees)} attendees · Target ${inr(e.target)}</p><p class="sm mute">Benefits: ${esc(e.benefits.join(', ') || 'none')}</p><div class="row mt"><button class="btn sm" data-a="editEvent" data-id="${e.id}">Edit</button><button class="btn sm" data-a="eventSponsors" data-id="${e.id}">Find Sponsors</button><button class="btn sm danger" data-a="delEvent" data-id="${e.id}">Delete</button></div></div>`).join('') : empty('No events yet. Create your first event to see sponsor fits.')}</div></div>`;
  },
  details() {
    const e = ev(ctx.eventId), pick = `<div class="card"><label style="margin-top:0">Event</label><select data-ch="ctxEvent">${eventOpts(ctx.eventId)}</select></div>`;
    if (!e) return pick + empty('Select or create an event to see its details.', '<button class="btn pri mt" data-a="go" data-p="events">Create Event</button>');
    const recs = state.pipeline.filter(r => r.eventId === e.id), certs = state.certs.filter(c => c.eventId === e.id).length;
    const row = (l, v) => `<div class="row between"><span class="mute">${l}</span><b style="text-align:right">${esc(v)}</b></div>`;
    return pick + `<div class="split mt"><div class="card"><div class="row between"><h3>${esc(e.name)}</h3><span class="pill">${esc(e.category)}</span></div><p class="mute mt">${esc(e.description)}</p><div class="list mt">${row('Date', e.date)}${row('College / city', e.city)}${row('Target audience', e.audience)}${row('Expected attendees', e.attendees)}${row('Funding target', inr(e.target))}${row('Sponsorship benefits', e.benefits.join(', ') || 'None')}</div>
    <div class="row mt"><button class="btn" data-a="editEvent2" data-id="${e.id}">Edit Event</button><button class="btn" data-a="go" data-p="certificates">Issue Certificates</button><button class="btn" data-a="copyDetails" data-id="${e.id}">Copy Details</button></div></div>
    <div><div class="grid g3"><div class="card stat"><b>${recs.length}</b><span>Sponsors in pipeline</span></div><div class="card stat"><b>${recs.filter(r => r.status === 'Confirmed').length}</b><span>Confirmed</span></div><div class="card stat"><b>${certs}</b><span>Certificates</span></div></div>
    <div class="card mt"><b>Sponsor status for this event</b><div class="list mt">${recs.map(r => `<div class="row between"><span>${esc(sp(r.sponsorId)?.name)}</span>${pill(r.status)}</div>`).join('') || '<p class="mute">No sponsors tracked yet.</p>'}</div></div></div></div>`;
  },
  certificates() {
    const e = ev(ctx.eventId), f = ctx.certForm || { names: '', role: 'Participant', issuer: 'Campus Events Club' }, list = state.certs.filter(c => c.eventId === ctx.eventId);
    return `<div class="split"><div class="card"><h3>Add students</h3><label>Event</label><select data-ch="ctxEvent">${eventOpts(ctx.eventId)}</select>
    <label>Student names (one per line)</label><textarea id="cNames" placeholder="Riya Sharma&#10;Aman Verma">${esc(f.names)}</textarea>
    <label>Role</label><select id="cRole">${opts(ROLES, f.role)}</select><label>Issued by</label><input id="cIssuer" value="${esc(f.issuer)}">
    <div class="row mt"><button class="btn pri" data-a="addStudents">Create Certificates</button></div>
    <p class="note mt">Certificates are generated in your browser from the event details. Preview one, then print it or save it as PDF from the print dialog.</p></div>
    <div class="card"><div class="row between"><h3>Certificates${e ? ' · ' + esc(e.name) : ''}</h3><span class="pill">${list.length}</span></div>
    ${list.length ? `<div class="list mt">${list.map(c => `<div class="row between"><span>${esc(c.name)} <span class="sm mute">· ${esc(c.role)}</span></span><span class="row"><button class="btn sm" data-a="previewCert" data-id="${c.id}">Preview</button><button class="btn sm danger" data-a="delCert" data-id="${c.id}">Delete</button></span></div>`).join('')}</div>` : empty('No certificates yet for this event. Add student names to create them.')}</div></div>`;
  },
  find() {
    const q = ctx.q.toLowerCase(), e = ev(ctx.eventId);
    const list = SPONSORS.filter(s => (!ctx.industry || s.industry === ctx.industry) && (`${s.name} ${s.desc} ${s.goals.join(' ')}`).toLowerCase().includes(q)).map(s => ({ s, f: e ? scoreFit(e, s) : null })).sort((a, b) => (b.f?.total || 0) - (a.f?.total || 0));
    return `<div class="card"><div class="row"><select id="fEvent" data-ch="ctxEvent" style="flex:1;min-width:180px">${eventOpts(ctx.eventId)}</select><input id="fSearch" data-ch="search" placeholder="Search sponsors" value="${esc(ctx.q)}" style="flex:1;min-width:160px"><select data-ch="industry" style="flex:1;min-width:160px">${opts([...new Set(SPONSORS.map(s => s.industry))], ctx.industry, 'All industries')}</select></div><p class="note mt">${NOTE} All sponsors are fictional demo entries, not verified and not contacted.</p></div>
    ${e ? '' : '<p class="mute mt">Select or create an event to see fit scores.</p>'}
    <div class="grid gfit mt">${list.length ? list.map(({ s, f }) => sponsorCard(s, f)).join('') : empty('No sponsors match your search.')}</div>`;
  },
  packages() {
    const e = ev(ctx.eventId), s = sp(ctx.sponsorId);
    const pk = e && s ? buildPackages(e, s) : [];
    return `<div class="card"><div class="row"><select data-ch="ctxEvent" style="flex:1">${eventOpts(ctx.eventId)}</select><select data-ch="ctxSponsor" style="flex:1">${sponsorOpts(ctx.sponsorId)}</select></div><p class="note mt">Prices are demo estimates, not verified market rates or commitments.</p></div>
    ${pk.length ? `<div class="grid g3 mt">${pk.map(p => { Object.assign(p, state.custom?.[`${e.id}:${s.id}:${p.id}`] || {}); return `<div class="card pkg"><div class="row between"><b>${p.name}</b>${ctx.pkgId === p.id ? '<span class="pill g">Selected</span>' : ''}</div><p class="mt"><b>${inr(p.range[0])}–${inr(p.range[1])}</b> <span class="sm mute">demo estimate</span></p><p class="sm mute mt">Benefits: ${esc(p.benefits.join(', ') || 'None selected on the event')}</p><p class="sm mt">${esc(p.why)}</p><div class="row mt"><button class="btn pri sm" data-a="selectPkg" data-id="${p.id}">Select Package</button><button class="btn sm" data-a="customPkg" data-id="${p.id}">Customize Package</button></div></div>`; }).join('')}</div>` : empty('Choose an event and a sponsor to see suggested packages.')}
    ${ctx.pkgId && pk.length ? '<div class="row mt"><button class="btn pri" data-a="go" data-p="outreach">Draft Outreach with this package</button></div>' : ''}`;
  },
  outreach() {
    const d = ctx.draft;
    return `<div class="split"><div class="card"><h3>Outreach settings</h3>
    <label>Event</label><select id="oEvent" data-ch="ctxEvent">${eventOpts(ctx.eventId)}</select>
    <label>Sponsor</label><select id="oSponsor" data-ch="ctxSponsor">${sponsorOpts(ctx.sponsorId)}</select>
    <label>Package</label><select id="oPkg" data-ch="ctxPkg">${opts(ev(ctx.eventId) && sp(ctx.sponsorId) ? buildPackages(ev(ctx.eventId), sp(ctx.sponsorId)).map(p => [p.id, p.name]) : [], ctx.pkgId, 'No package')}</select>
    <label>Channel</label><select id="oChannel" data-ch="channel">${opts(['Email','LinkedIn','WhatsApp'], ctx.channel)}</select>
    <label>Tone</label><select id="oTone" data-ch="tone">${opts(['Professional','Friendly','Persuasive'], ctx.tone)}</select>
    <div class="row mt"><button class="btn pri" data-a="generate">Generate Draft</button><button class="btn" data-a="generate">Regenerate</button></div>
    <p class="note mt">${API.connected ? (API.gemma ? 'Drafts come from Gemma 4 through your backend.' : 'Backend connected, using built-in templates (no model configured).') : 'Templates run in your browser (Demo Mode). No AI model is connected.'} Nothing is sent. You review, copy and send outreach yourself.</p></div>
    <div class="card"><div class="row between"><h3>Draft</h3><span class="sm mute" id="draftState">${d ? 'Editable draft' : ''}</span></div>
    ${d ? `${(ctx.flags || []).map(f => `<p class="concern mt">Check before sending: ${esc(f)}</p>`).join('')}<label>Subject (email)</label><input id="dSubject" value="${esc(d.subject)}"><label>Message</label><textarea id="dBody" style="min-height:320px">${esc(d.body)}</textarea>
    <div class="row mt"><button class="btn" data-a="copy">Copy</button><button class="btn" data-a="editFocus">Edit</button><button class="btn pri" data-a="saveDraft">Save Draft</button><button class="btn" data-a="followup">Generate Follow-up</button></div>`
    : empty('Pick an event and sponsor, then select Generate Draft.')}
    ${state.drafts.length ? `<div class="list mt"><b>Saved drafts</b>${state.drafts.slice(0, 5).map(x => `<div class="row between"><span class="sm">${esc(sp(x.sponsorId)?.name)} · ${esc(x.channel)} · ${x.date}</span><span class="row"><button class="btn sm" data-a="loadDraft" data-id="${x.id}">Open</button><button class="btn sm danger" data-a="delDraft" data-id="${x.id}">Delete</button></span></div>`).join('')}</div>` : ''}</div></div>`;
  },
  pipeline() {
    const q = ctx.pq.toLowerCase(), rows = state.pipeline.filter(r => (!ctx.ps || r.status === ctx.ps) && `${sp(r.sponsorId)?.name} ${ev(r.eventId)?.name} ${r.notes}`.toLowerCase().includes(q));
    const fit = r => fitFor(r.eventId, r.sponsorId)?.total ?? '–';
    const card = r => `<div class="kcard ${overdue(r) ? 'over' : ''}"><b>${esc(sp(r.sponsorId)?.name)}</b><div class="mute">${esc(ev(r.eventId)?.name || 'Event removed')}</div><div class="mt">Fit ${fit(r)} · Follow-up ${esc(r.followUp || 'not set')}${overdue(r) ? ' <span class="pill r">Overdue</span>' : ''}</div><div class="mute">Next: ${esc(r.nextAction || '–')}</div><div class="row mt"><select data-ch="status" data-id="${r.id}">${opts(STATUSES, r.status)}</select><button class="btn sm" data-a="editRec" data-id="${r.id}">Edit</button></div></div>`;
    return `<div class="card"><div class="row"><input data-ch="pq" placeholder="Search pipeline" value="${esc(ctx.pq)}" style="flex:1;min-width:160px"><select data-ch="ps" style="width:180px">${opts(STATUSES, ctx.ps, 'All statuses')}</select><button class="btn ${state.settings.view === 'kanban' ? 'pri' : ''}" data-a="viewMode" data-m="kanban">Kanban</button><button class="btn ${state.settings.view === 'table' ? 'pri' : ''}" data-a="viewMode" data-m="table">Table</button><button class="btn pri" data-a="addRec">Add Record</button></div></div><div class="mt">` +
    (!state.pipeline.length ? empty('No pipeline records yet. Add a sponsor you plan to contact.') : state.settings.view === 'kanban'
      ? `<div class="kanban">${STATUSES.map(st => `<div class="col"><h3>${st}<span>${rows.filter(r => r.status === st).length}</span></h3>${rows.filter(r => r.status === st).map(card).join('')}</div>`).join('')}</div>`
      : `<div class="card tablewrap"><table><thead><tr><th>Sponsor</th><th>Event</th><th>Fit</th><th>Status</th><th>Last contact</th><th>Next action</th><th>Follow-up</th><th>Notes</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${overdue(r) ? 'over' : ''}"><td>${esc(sp(r.sponsorId)?.name)}</td><td>${esc(ev(r.eventId)?.name || '–')}</td><td>${fit(r)}</td><td><select data-ch="status" data-id="${r.id}">${opts(STATUSES, r.status)}</select></td><td>${esc(r.lastContact || '–')}</td><td>${esc(r.nextAction || '–')}</td><td>${esc(r.followUp || '–')}${overdue(r) ? ' <span class="pill r">Overdue</span>' : ''}</td><td>${esc(r.notes || '–')}</td><td class="row"><button class="btn sm" data-a="editRec" data-id="${r.id}">Edit</button><button class="btn sm danger" data-a="delRec" data-id="${r.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`) + '</div>';
  },
  saved() {
    const e = ev(ctx.eventId), list = SPONSORS.filter(s => isSaved(s.id));
    return list.length ? `<p class="note">${NOTE}</p><div class="grid gfit mt">${list.map(s => sponsorCard(s, e ? scoreFit(e, s) : null)).join('')}</div>` : empty('No saved sponsors yet. Save sponsors from Find Sponsors.', '<button class="btn pri mt" data-a="go" data-p="find">Explore Sponsors</button>');
  },
  settings() {
    const st = state.settings;
    return `<div class="card" style="max-width:560px"><label>Default outreach tone</label><select data-ch="setTone">${opts(['Professional','Friendly','Persuasive'], st.tone)}</select><label>Default event</label><select data-ch="setEvent">${eventOpts(st.defaultEvent)}</select><label>Preferred dashboard view (pipeline)</label><select data-ch="setView">${opts([['kanban','Kanban'],['table','Table']], st.view)}</select><label class="row" style="margin-top:16px"><input type="checkbox" style="width:auto" data-ch="setNotify" ${st.notify ? 'checked' : ''}> Demo notifications (toasts)</label><div class="row mt"><button class="btn danger" data-a="reset">Reset demo data</button></div><p class="sm mute mt">Mode: ${API.connected ? 'Backend connected' : 'Demo Mode — local data and templates only. No Gemma 4 model is connected.'}</p></div>`;
  }
};
function sponsorCard(s, f) {
  return `<div class="card sponsor"><div class="row between"><div><b>${esc(s.name)}</b><div class="sm mute">${esc(s.industry)}</div></div>${f ? scoreDial(f.total) : '<span class="pill y">No score</span>'}</div>
  <p class="sm">${esc(s.desc)}</p><div class="sm"><b>Possible goals:</b> ${esc(s.goals.join(', '))}</div>
  ${f ? `<div class="sm mute">${esc(f.parts.slice().sort((a, b) => b.pts / b.max - a.pts / a.max)[0].label)} is the strongest factor.</div><div class="concern"><b>Missing / concerns:</b> ${esc(f.missing.join('; '))}</div>` : ''}
  <div class="row"><button class="btn sm" data-a="viewFit" data-id="${s.id}">View Fit</button><button class="btn sm ${isSaved(s.id) ? 'pri' : ''}" data-a="toggleSave" data-id="${s.id}">${isSaved(s.id) ? 'Unsave Sponsor' : 'Save Sponsor'}</button><button class="btn sm" data-a="buildPkg" data-id="${s.id}">Build Package</button><button class="btn sm" data-a="draftFor" data-id="${s.id}">Draft Outreach</button></div></div>`;
}
function eventForm(e = {}) {
  return `<form id="eventForm" novalidate><input type="hidden" name="id" value="${esc(e.id || '')}">
  <label>Event name</label><input name="name" value="${esc(e.name || '')}"><div class="err" data-err="name"></div>
  <label>Event category</label><select name="category">${opts(CATEGORIES, e.category, 'Select category')}</select><div class="err" data-err="category"></div>
  <label>Event description</label><textarea name="description">${esc(e.description || '')}</textarea><div class="err" data-err="description"></div>
  <label>Target audience</label><input name="audience" value="${esc(e.audience || '')}"><div class="err" data-err="audience"></div>
  <label>Expected attendees</label><input name="attendees" type="number" min="1" value="${esc(e.attendees || '')}"><div class="err" data-err="attendees"></div>
  <label>College or city</label><input name="city" value="${esc(e.city || '')}"><div class="err" data-err="city"></div>
  <label>Event date</label><input name="date" type="date" value="${esc(e.date || '')}"><div class="err" data-err="date"></div>
  <label>Funding target (₹)</label><input name="target" type="number" min="1" value="${esc(e.target || '')}"><div class="err" data-err="target"></div>
  <label>Available sponsorship benefits</label><div class="checks">${BENEFITS.map(b => `<label><input type="checkbox" name="benefits" value="${b}" ${(e.benefits || []).includes(b) ? 'checked' : ''}> ${b}</label>`).join('')}</div><div class="err" data-err="benefits"></div>
  <div class="row mt"><button class="btn pri" type="submit">${e.id ? 'Save changes' : 'Create Event'}</button>${e.id ? '<button class="btn" type="button" data-a="go" data-p="events">Cancel</button>' : ''}</div></form>`;
}
function fitModal(sid) {
  const s = sp(sid), e = ev(ctx.eventId);
  if (!e) return modal(`<h3>${esc(s.name)}</h3><p class="mt">Select or create an event first to calculate fit.</p><div class="row mt"><button class="btn" data-a="closeModal">Close</button></div>`);
  const f = scoreFit(e, s);
  modal(`<div class="row between"><div><h3>${esc(s.name)} · ${esc(e.name)}</h3><p class="sm mute">Fictional demo sponsor</p></div>${scoreDial(f.total)}</div>${f.parts.map(p => `<div class="mt"><div class="row between"><b class="sm">${p.label}</b><span class="sm">${p.pts}/${p.max}</span></div><div class="bar"><i style="width:${p.pts / p.max * 100}%"></i></div><div class="sm mute">${esc(p.why)}</div></div>`).join('')}<div class="concern mt"><b>Missing information:</b> ${esc(f.missing.join('; '))}</div><p class="note mt">${NOTE}</p><div class="row mt"><button class="btn" data-a="closeModal">Close</button></div>`);
}
function certModal(id) {
  const c = state.certs.find(x => x.id === id);
  modal(`<div class="cert"><div class="cert-in"><p class="sm mute">${esc(c.issuer)}</p><h2>Certificate of ${esc(c.role)}</h2><p>This certificate is proudly presented to</p><div class="cert-name">${esc(c.name)}</div><p>for taking part as <b>${esc(c.role)}</b> in</p><h3>${esc(c.eventName)}</h3><p class="sm mute">${esc(c.category)} · ${esc(c.date)} · ${esc(c.city)}</p><div class="cert-sign"><span>Event Coordinator</span><span>Faculty Advisor</span></div><p class="sm mute">Certificate no. ${esc(c.number)} · Issued ${esc(c.issued)}</p></div></div><div class="row mt"><button class="btn pri" data-a="printCert">Print / Save as PDF</button><button class="btn" data-a="closeModal">Close</button></div>`);
}
function recordForm(r = {}) {
  modal(`<h3>${r.id ? 'Edit record' : 'Add pipeline record'}</h3><form id="recForm"><input type="hidden" name="id" value="${r.id || ''}">
  <label>Sponsor</label><select name="sponsorId" ${r.id ? 'disabled' : ''}>${sponsorOpts(r.sponsorId || ctx.sponsorId)}</select>
  <label>Event</label><select name="eventId">${eventOpts(r.eventId || ctx.eventId)}</select>
  <label>Status</label><select name="status">${opts(STATUSES, r.status || 'Researching')}</select>
  <label>Last contact date</label><input type="date" name="lastContact" value="${esc(r.lastContact || '')}">
  <label>Next action</label><input name="nextAction" value="${esc(r.nextAction || '')}">
  <label>Follow-up date</label><input type="date" name="followUp" value="${esc(r.followUp || '')}">
  <label>Notes</label><textarea name="notes">${esc(r.notes || '')}</textarea><div class="err" id="recErr"></div>
  <div class="row mt"><button class="btn pri" type="submit">Save record</button><button class="btn" type="button" data-a="closeModal">Cancel</button></div></form>`);
}

/* ===== 7. ACTIONS & EVENT WIRING ===== */
function render() {
  $('#nav').innerHTML = PAGES.map(([k, l]) => `<button data-a="go" data-p="${k}" class="${k === page ? 'on' : ''}"><svg viewBox="0 0 24 24"><path d="${ICONS[k]}"/></svg>${l}</button>`).join('');
  $('#pageTitle').textContent = PAGES.find(p => p[0] === page)[1];
  $('#view').innerHTML = views[page]();
  const b = $('#demoBadge'); b.textContent = API.connected ? 'Backend connected' : 'Demo Mode'; b.classList.toggle('live', API.connected);
  $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open');
}
const go = p => { page = p; render(); window.scrollTo(0, 0); };
const note = (m, bad) => { if (state.settings.notify || bad) toast(m, bad); };
function ensureRecord(eid, sid) {
  if (!state.pipeline.some(r => r.eventId === eid && r.sponsorId === sid)) {
    const r = { id: uid('p'), sponsorId: sid, eventId: eid, status: 'Ready to Contact', lastContact: '', nextAction: 'Review draft and send manually', followUp: addDays(5), notes: '' };
    state.pipeline.push(r); API.saveProspect(r).catch(() => {});
  }
}
function keepEdits() { if (page === 'certificates' && $('#cNames')) ctx.certForm = { names: $('#cNames').value, role: $('#cRole').value, issuer: $('#cIssuer').value }; const cur = page === 'outreach' ? currentDraftText() : null; if (cur && ctx.draft) ctx.draft = cur; } // keep unsaved edits before a re-render
function currentDraftText() { const sub = $('#dSubject'), b = $('#dBody'); return b ? { subject: sub ? sub.value : '', body: b.value } : null; }
function draftFromAll() { const a = ctx.all; if (!a) return null; return ctx.channel === 'Email' ? { subject: a.subject, body: a.email } : { subject: '', body: ctx.channel === 'LinkedIn' ? a.linkedin : a.whatsapp }; }
const actions = {
  editEvent2: d => { go('events'); actions.editEvent(d); },
  copyDetails: async d => { const e = ev(d.id), t = `${e.name}\n${e.category} · ${e.date} · ${e.city}\nAttendees: ${e.attendees}\nAudience: ${e.audience}\n${e.description}`; try { await navigator.clipboard.writeText(t); toast('Event details copied'); } catch { toast('Copy failed. Select the text manually.', true); } },
  addStudents: async () => {
    const e = ev(ctx.eventId); keepEdits(); const f = ctx.certForm || {};
    const names = (f.names || '').split('\n').map(n => n.trim().slice(0, 80)).filter(Boolean);
    if (!e) return toast('Select an event first', true);
    if (!names.length) return toast('Enter at least one student name', true);
    const local = names.map(n => ({ id: uid('c'), eventId: e.id, name: n, role: f.role || 'Participant', issuer: (f.issuer || '').trim() || 'Campus Events Club', eventName: e.name, category: e.category, date: e.date, city: e.city, number: 'EW-' + Math.random().toString(36).slice(2, 8).toUpperCase(), issued: today() }));
    let made = null;
    try { made = await API.createCerts(e.id, { event: e, names, role: f.role || 'Participant', issuer: (f.issuer || '').trim() || 'Campus Events Club' }); } catch {}
    state.certs.push(...(made || local));
    ctx.certForm = { names: '', role: f.role, issuer: f.issuer }; log(`${names.length} certificate(s) created for ${e.name}`); save(); render(); toast(`${names.length} certificate(s) created`);
  },
  previewCert: d => certModal(d.id), printCert: () => window.print(),
  delCert: d => confirmBox('Delete this certificate?', () => { API.remove(`/api/certificates/${d.id}`).catch(() => {}); state.certs = state.certs.filter(c => c.id !== d.id); save(); render(); note('Certificate deleted'); }),
  go: d => go(d.p), closeModal, profile: () => modal('<h3>Asha Kapoor</h3><p class="mute mt">Campus Events Club · Demo user</p><p class="sm mt">Profile is a sample. There is no sign-in in Demo Mode.</p><div class="row mt"><button class="btn" data-a="closeModal">Close</button></div>'),
  toggleNav: () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('open'); },
  backdrop: (d, ev2) => { if (ev2.target.classList.contains('back')) closeModal(); },
  confirmYes: () => { const cb = confirmBox.cb; closeModal(); cb && cb(); },
  editEvent: d => { $('#view').querySelector('.card').innerHTML = `<h3>Edit event</h3>${eventForm(ev(d.id))}`; window.scrollTo(0, 0); },
  delEvent: d => confirmBox('Delete this event and its pipeline records?', () => { API.remove(`/api/events/${d.id}`).catch(() => {}); state.events = state.events.filter(e => e.id !== d.id); state.pipeline = state.pipeline.filter(r => r.eventId !== d.id); if (ctx.eventId === d.id) ctx.eventId = ''; log('Event deleted'); save(); render(); note('Event deleted'); }),
  eventSponsors: d => { ctx.eventId = d.id; go('find'); },
  viewFit: d => fitModal(d.id),
  toggleSave: d => { state.saved = isSaved(d.id) ? state.saved.filter(x => x !== d.id) : [...state.saved, d.id]; log(`${isSaved(d.id) ? 'Saved' : 'Unsaved'} ${sp(d.id).name}`); save(); render(); note(isSaved(d.id) ? 'Sponsor saved' : 'Sponsor removed from saved'); },
  buildPkg: d => { ctx.sponsorId = d.id; ctx.pkgId = ''; go('packages'); },
  draftFor: d => { ctx.sponsorId = d.id; ctx.draft = null; ctx.all = null; go('outreach'); },
  selectPkg: d => { ctx.pkgId = d.id; render(); note('Package selected'); },
  customPkg: d => { const p = buildPackages(ev(ctx.eventId), sp(ctx.sponsorId)).find(x => x.id === d.id); Object.assign(p, state.custom?.[`${ctx.eventId}:${ctx.sponsorId}:${p.id}`] || {}); modal(`<h3>Customize ${p.name}</h3><form id="pkgForm" data-id="${p.id}"><label>Minimum (₹, demo estimate)</label><input name="lo" type="number" value="${p.range[0]}"><label>Maximum (₹, demo estimate)</label><input name="hi" type="number" value="${p.range[1]}"><label>Benefits</label><div class="checks">${BENEFITS.map(b => `<label><input type="checkbox" name="b" value="${b}" ${p.benefits.includes(b) ? 'checked' : ''}> ${b}</label>`).join('')}</div><div class="row mt"><button class="btn pri" type="submit">Save customization</button><button type="button" class="btn" data-a="closeModal">Cancel</button></div></form>`); },
  generate: async () => {
    const e = ev(ctx.eventId), s = sp(ctx.sponsorId);
    if (!e || !s) return toast('Select an event and a sponsor first', true);
    $('#view').querySelectorAll('.card')[1].insertAdjacentHTML('afterbegin', '<div id="load"><span class="spin"></span> Generating draft…</div>');
    let src = 'template-based, Demo Mode'; ctx.flags = [];
    try {
      ctx.all = await API.createOutreach(`${e.id}:${s.id}`, { event: e, package: currentPkg(), channel: ctx.channel, tone: ctx.tone });
      ctx.flags = ctx.all.risk_flags || []; src = ctx.all.source === 'gemma' ? 'Gemma 4' : 'backend templates';
    } catch {
      await new Promise(r => setTimeout(r, 600));
      ctx.all = generateOutreach(e, s, currentPkg(), ctx.channel, ctx.tone);
    }
    ctx.draft = draftFromAll(); render(); note(`Draft generated (${src})`);
  },
  copy: async () => { const d = currentDraftText(); const t = (d.subject ? 'Subject: ' + d.subject + '\n\n' : '') + d.body; try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); } toast('Copied to clipboard'); },
  editFocus: () => $('#dBody').focus(),
  saveDraft: () => { const d = currentDraftText(); state.drafts.unshift({ id: uid('d'), eventId: ctx.eventId, sponsorId: ctx.sponsorId, pkgId: ctx.pkgId, channel: ctx.channel, subject: d.subject, body: d.body, date: today() }); ensureRecord(ctx.eventId, ctx.sponsorId); log(`Draft saved for ${sp(ctx.sponsorId).name}`); save(); render(); note('Draft saved. Pipeline record ready; send it yourself.'); },
  followup: () => { const e = ev(ctx.eventId), s = sp(ctx.sponsorId); const all = generateOutreach(e, s, currentPkg(), ctx.channel, ctx.tone); ctx.draft = { subject: '', body: all.follow1 + '\n\n--- Final follow-up ---\n\n' + all.follow2 }; render(); note('Follow-ups generated'); },
  loadDraft: d => { const x = state.drafts.find(y => y.id === d.id); ctx.eventId = x.eventId; ctx.sponsorId = x.sponsorId; ctx.pkgId = x.pkgId; ctx.channel = x.channel; ctx.draft = { subject: x.subject, body: x.body }; render(); },
  delDraft: d => { keepEdits(); state.drafts = state.drafts.filter(x => x.id !== d.id); save(); render(); note('Draft deleted'); },
  viewMode: d => { state.settings.view = d.m; save(); render(); },
  addRec: () => recordForm(), editRec: d => recordForm(state.pipeline.find(r => r.id === d.id)),
  delRec: d => confirmBox('Delete this pipeline record?', () => { API.remove(`/api/prospects/${d.id}`).catch(() => {}); state.pipeline = state.pipeline.filter(r => r.id !== d.id); save(); render(); note('Record deleted'); }),
  reset: () => confirmBox('Reset all demo data and settings? Your events, drafts and records will be replaced.', () => { state = seed(); ctx = { eventId: 'e1', sponsorId: '', pkgId: '', channel: 'Email', draft: null, all: null, certForm: null, tone: 'Professional', q: '', industry: '', pq: '', ps: '' }; save(); render(); toast('Demo data reset'); })
};
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && actions[b.dataset.a]) actions[b.dataset.a](b.dataset, e); });
const changes = {
  ctxEvent: v => { ctx.eventId = v; ctx.pkgId = ''; ctx.draft = null; ctx.all = null; }, ctxSponsor: v => { ctx.sponsorId = v; ctx.pkgId = ''; ctx.draft = null; ctx.all = null; }, ctxPkg: v => { ctx.pkgId = v; },
  channel: v => { ctx.channel = v; ctx.draft = draftFromAll(); }, tone: v => { ctx.tone = v; }, industry: v => { ctx.industry = v; }, ps: v => { ctx.ps = v; },
  setTone: v => { state.settings.tone = v; save(); }, setEvent: v => { state.settings.defaultEvent = v; ctx.eventId = v; save(); }, setView: v => { state.settings.view = v; save(); }
};
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset.ch; if (!k) return;
  keepEdits();
  if (k === 'status') { const r = state.pipeline.find(x => x.id === t.dataset.id); r.status = t.value; if (t.value === 'Contacted') r.lastContact = today(); API.updateProspect(r.id, { status: r.status }).catch(() => {}); log(`${sp(r.sponsorId).name} → ${t.value}`); save(); render(); return note('Status updated to ' + t.value); }
  if (k === 'setNotify') { state.settings.notify = t.checked; save(); return; }
  changes[k] && changes[k](t.value); render();
});
document.addEventListener('input', e => { const k = e.target.dataset.ch; if (k === 'search' || k === 'pq') { ctx[k === 'search' ? 'q' : 'pq'] = e.target.value; const pos = e.target.selectionStart; render(); const el = $(`[data-ch="${k}"]`); el.focus(); el.setSelectionRange(pos, pos); } });
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'eventForm') {
    const d = new FormData(f), v = n => (d.get(n) || '').toString().trim(), errs = {};
    if (!v('name')) errs.name = 'Enter an event name.'; if (!v('category')) errs.category = 'Choose a category.';
    if (v('description').length < 20) errs.description = 'Describe the event in at least 20 characters.'; if (!v('audience')) errs.audience = 'Describe your target audience.';
    if (!(Number(v('attendees')) > 0)) errs.attendees = 'Enter a number above 0.'; if (!v('city')) errs.city = 'Enter a college or city.';
    if (!v('date')) errs.date = 'Choose a date.'; if (!(Number(v('target')) > 0)) errs.target = 'Enter a target above 0.'; if (!d.getAll('benefits').length) errs.benefits = 'Select at least one benefit.';
    f.querySelectorAll('[data-err]').forEach(x => x.textContent = errs[x.dataset.err] || '');
    if (Object.keys(errs).length) return toast('Please fix the highlighted fields', true);
    const rec = { id: v('id') || uid('e'), name: v('name'), category: v('category'), description: v('description'), audience: v('audience'), attendees: Number(v('attendees')), city: v('city'), date: v('date'), target: Number(v('target')), benefits: d.getAll('benefits') };
    const i = state.events.findIndex(x => x.id === rec.id); i >= 0 ? state.events[i] = rec : state.events.push(rec);
    API.createEvent(rec).catch(() => {}); // no-op in demo mode
    ctx.eventId = rec.id; log(`${i >= 0 ? 'Updated' : 'Created'} event ${rec.name}`); save(); render(); toast(i >= 0 ? 'Event updated' : 'Event created');
  } else if (f.id === 'recForm') {
    const d = new FormData(f), id = d.get('id'), r = id ? state.pipeline.find(x => x.id === id) : { id: uid('p'), sponsorId: d.get('sponsorId') };
    if (!r.sponsorId || !d.get('eventId')) return $('#recErr').textContent = 'Choose a sponsor and an event.';
    Object.assign(r, { eventId: d.get('eventId'), status: d.get('status'), lastContact: d.get('lastContact'), nextAction: d.get('nextAction'), followUp: d.get('followUp'), notes: d.get('notes') });
    if (!id) state.pipeline.push(r); API.saveProspect(r).catch(() => {}); log(`Pipeline record ${id ? 'updated' : 'added'}: ${sp(r.sponsorId).name}`); save(); closeModal(); render(); note('Record saved');
  } else if (f.id === 'pkgForm') {
    const d = new FormData(f); state.custom = state.custom || {};
    state.custom[`${ctx.eventId}:${ctx.sponsorId}:${f.dataset.id}`] = { range: [Number(d.get('lo')), Number(d.get('hi'))], benefits: d.getAll('b') };
    save(); closeModal(); render(); note('Package customized');
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
render();
API.init().then(() => { render(); if (API.connected) { state.events.forEach(e => API.createEvent(e).catch(() => {})); state.pipeline.forEach(r => API.saveProspect(r).catch(() => {})); state.certs.forEach(c => API.saveCert(c).catch(() => {})); } });
