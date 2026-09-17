import sharp from 'sharp';

// Disables libvips' internal operation cache and forces single-threaded
// processing. Works around a Windows-specific failure mode where Sharp's
// native module gets stuck inside one long-lived process (e.g. `next dev`)
// — every subsequent file it tries to open fails with a generic "unknown
// error, open <path>" (see lib/fs-retry.ts), even though the exact same
// file opens fine immediately from a freshly started process. Import this
// once for its side effect, before any other sharp usage.
sharp.cache(false);
sharp.concurrency(1);
