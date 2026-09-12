// Run with: node tests/bp-portal.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');

const phone = '01712345678';
const photo = path.resolve('public/frames/original-photo.png');
const activeEventPdf = path.resolve('public/logos/Logo.png');
const record = { id: 'booth-1', name: 'Customer', phone, selectedJob: 'Doctor', status: 'generated', createdAt: new Date(), originalImagePath: photo, generatedImagePath: photo };
let downloads = 0;
let reads = 0;
const mocks = {
  '@/lib/db': {
    session: {
      findUnique: async () => { reads++; return record; },
      findMany: async ({ where }) => (where.phone?.in ?? []).includes(phone) ? [record] : [],
      // Only a real downloadCount bump counts as a "download" — persisting a
      // pre-rendered image's cache path is a separate, non-download update.
      update: async ({ data }) => { if (data?.downloadCount) downloads++; },
    },
    participant: { findMany: async () => [] },
    image: {
      findUnique: async () => ({
        originalImageUrl: photo,
        aiImageUrl: photo,
        id: 'mobile-1',
        participant: { name: 'Customer', career: 'Doctor', phone, event: { pdfPath: photo, pdfName: 'Custom Event Comic.pdf' } },
      }),
      update: async ({ data }) => { if (data?.downloadCount) downloads++; },
    },
    // The booth flow has no event of its own — it borrows whichever event is
    // currently active, so this only ever gets queried with isActive: true.
    event: {
      findFirst: async ({ where }) => where.isActive ? { pdfPath: activeEventPdf, pdfName: 'Active Event Comic.pdf' } : null,
    },
  },
  '@/lib/auth': {
    getTokenFromRequest: (req) => req.cookies.get('admin_token')?.value,
    validateAdminToken: async (token) => token === 'valid-staff' ? { id: 'staff' } : null,
  },
  '@/lib/download-session': {
    DOWNLOAD_SESSION_COOKIE: 'dl_session',
    verifyDownloadSessionToken: (token) => token === 'valid-customer' ? { phone } : token === 'other-customer' ? { phone: '01999999999' } : null,
  },
  '@/lib/original-photo-frame': { frameOriginalPhoto: async () => Buffer.from('framed-original') },
  '@/lib/generated-photo-logo': { brandGeneratedPhoto: async () => Buffer.from('branded-ai') },
  '@/lib/generated-photo-frame': { frameGeneratedPhoto: async (_photo, job) => {
    assert.equal(job, 'Doctor', 'Use the dream job from the booth or mobile record');
    return Buffer.from('career-frame');
  } },
};
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    const absolute = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
    const alias = absolute ? '@/' + path.relative(process.cwd(), absolute).split(path.sep).join('/') : name;
    if (mocks[alias]) return mocks[alias];
    return absolute ? load(absolute + '.ts') : require(name);
  };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const request = (url, cookie = '') => new NextRequest('http://localhost' + url, { headers: { cookie } });

(async () => {
  const bpFile = load('app/api/bp/file/[source]/[id]/[type]/route.ts').GET;
  const customerFile = load('app/api/download/file/[source]/[id]/[type]/route.ts').GET;
  const gallery = load('app/api/bp/gallery/route.ts').GET;
  const params = { source: 'booth', id: 'booth-1', type: 'original' };
  for (const cookie of ['', 'admin_token=expired', 'dl_session=valid-customer']) {
    assert.equal((await bpFile(request('/api/bp/file', cookie), { params })).status, 401);
    assert.equal((await gallery(request('/api/bp/gallery?phone=' + phone, cookie))).status, 401);
  }
  assert.equal(reads, 0, 'Unauthorized staff requests must not read customer records');
  for (const cookie of ['', 'admin_token=valid-staff', 'dl_session=other-customer', 'dl_session=123456']) {
    assert.equal((await customerFile(request('/api/download/file?authorizedStaff=true', cookie), { params })).status, 401);
  }
  assert.equal((await customerFile(request('/api/download/file', 'dl_session=valid-customer'), { params })).status, 200);
  for (const source of ['booth', 'mobile']) {
    for (const type of ['original', 'ai']) {
      const preview = await bpFile(request('/api/bp/file', 'admin_token=valid-staff'), { params: { ...params, source, type } });
      assert.equal(preview.status, 200);
      assert.equal(preview.headers.get('Cache-Control'), 'private, no-store');
      const before = downloads;
      const file = await bpFile(request('/api/bp/file?download=1', 'admin_token=valid-staff'), { params: { ...params, source, type } });
      assert.equal(await file.text(), await preview.text());
      assert.match(file.headers.get('Content-Disposition'), /attachment;.*\.jpg/);
      assert.equal(downloads, before + 1);
    }
  }
  // The comic-book download must use the participant's own event PDF
  // (Admin -> Events upload), not always fall back to the static default.
  const comicRes = await bpFile(request('/api/bp/file', 'admin_token=valid-staff'), { params: { source: 'mobile', id: 'mobile-1', type: 'comic-book' } });
  assert.equal(comicRes.status, 200);
  const comicBuf = Buffer.from(await comicRes.arrayBuffer());
  assert.ok(comicBuf.equals(fs.readFileSync(photo)), "Mobile comic-book download must use the participant's event PDF, not the static default");

  // The booth flow has no event of its own — it should borrow the currently
  // active event's PDF (same one mobile users for that event get), not the
  // static default, and not the unrelated mobile participant's event PDF.
  const boothComicRes = await bpFile(request('/api/bp/file', 'admin_token=valid-staff'), { params: { source: 'booth', id: 'booth-1', type: 'comic-book' } });
  assert.equal(boothComicRes.status, 200);
  const boothComicBuf = Buffer.from(await boothComicRes.arrayBuffer());
  assert.ok(boothComicBuf.equals(fs.readFileSync(activeEventPdf)), 'Booth comic-book download must use the active event PDF, not the static default');

  assert.equal((await gallery(request('/api/bp/gallery?phone=123', 'admin_token=valid-staff'))).status, 400);
  for (const value of [phone, '+88' + phone]) {
    const response = await gallery(request('/api/bp/gallery?phone=' + encodeURIComponent(value), 'admin_token=valid-staff'));
    const data = await response.json();
    assert.equal(data.submissions.length, 1);
    assert.match(data.submissions[0].originalUrl, /^\/api\/bp\/file\/booth\//);
    assert.equal(JSON.stringify(data).includes(photo), false, 'Do not expose filesystem paths');
  }
  console.log('BP portal checks passed: staff authentication, customer OTP isolation, phone search, branding, download counts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
