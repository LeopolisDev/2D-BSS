import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[i + 1];
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/set-admin.mjs --serviceAccount <path> --uid <uid> [--admin true|false]',
      '  node scripts/set-admin.mjs --serviceAccount <path> --email <email> [--admin true|false]',
      '',
      'Examples:',
      '  node scripts/set-admin.mjs --serviceAccount ./serviceAccount.json --email you@example.com --admin true',
      '  node scripts/set-admin.mjs --serviceAccount ./serviceAccount.json --uid abc123 --admin false'
    ].join('\n')
  );
}

function parseBoolean(input, fallback) {
  if (typeof input !== 'string') return fallback;
  const v = input.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const serviceAccountPath = args.serviceAccount ? resolve(args.serviceAccount) : '';
  const targetUid = args.uid || '';
  const targetEmail = args.email || '';
  const makeAdmin = parseBoolean(args.admin, true);

  if (!serviceAccountPath || (!targetUid && !targetEmail)) {
    usage();
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });

  const auth = getAuth();
  const userRecord = targetUid
    ? await auth.getUser(targetUid)
    : await auth.getUserByEmail(targetEmail);

  const currentClaims = userRecord.customClaims || {};
  const nextClaims = {
    ...currentClaims,
    admin: makeAdmin
  };

  await auth.setCustomUserClaims(userRecord.uid, nextClaims);

  const updated = await auth.getUser(userRecord.uid);
  console.log(
    JSON.stringify(
      {
        ok: true,
        uid: updated.uid,
        email: updated.email || null,
        admin: !!(updated.customClaims && updated.customClaims.admin),
        customClaims: updated.customClaims || {}
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Failed to set admin claim:', error?.message || error);
  process.exit(1);
});

