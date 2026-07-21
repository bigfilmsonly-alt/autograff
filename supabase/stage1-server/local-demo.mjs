import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const MIGRATION = new URL('../migrations/0001_autograff_economy.sql', import.meta.url).pathname;

const db = new PGlite();
const q = async (sql, params) => (await db.query(sql, params)).rows;
let PASS = 0, FAIL = 0;
const ok = (c, m) => { console.log(`   ${c ? '✅' : '❌'} ${m}`); c ? PASS++ : FAIL++; };
const asUser = (id) => db.query(`select set_config('app.current_user', $1, false)`, [id]);
async function giveHeart(userId, photoId, type = 'standard') {
  await asUser(userId);
  const r = await db.query(`select public.give_heart($1,$2) as res`, [photoId, type]);
  return r.rows[0].res;
}
async function expectFail(fn, needle, label) {
  try { await fn(); ok(false, `${label} — expected failure but it SUCCEEDED`); }
  catch (e) { ok(String(e.message).includes(needle), `${label} → blocked: "${e.message}"`); }
}

// --- Supabase shims so the real migration runs unchanged locally ---
await db.exec(`
  create role anon noinherit;
  create role authenticated noinherit;
  create role service_role noinherit;
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.current_user', true), '')::uuid $$;
`);

// Apply the ACTUAL migration (only local tweak: pgcrypto ext is a no-op here; gen_random_uuid is core in PG16).
let sql = readFileSync(MIGRATION, 'utf8').replace(/create extension if not exists pgcrypto;/, '-- pgcrypto (core gen_random_uuid used locally)');
await db.exec(sql);
console.log('\n── Migration applied to in-process Postgres 16 ──\n');

// Seed: 3 auth users -> handle_new_user trigger auto-creates profiles.
const creator = (await q(`insert into auth.users (email) values ('creator@x') returning id`))[0].id;
const alice   = (await q(`insert into auth.users (email) values ('alice@x')   returning id`))[0].id;
const bob     = (await q(`insert into auth.users (email) values ('bob@x')     returning id`))[0].id;
ok((await q(`select count(*)::int n from public.profiles`))[0].n === 3, 'trigger auto-created a profile for each new auth user');

const photo = (await q(`insert into public.photos (creator_id,image_url,title) values ($1,'/p/1.jpg','Big Wave') returning id`, [creator]))[0].id;

// Simulate a purchase grant the way the Stage-3 webhook will (ledger + cached balance together).
async function grantCredits(uid, amount) {
  await db.query(`insert into public.credit_ledger (user_id,delta,reason,balance_after)
                  values ($1,$2,'purchase',(select credit_balance from public.profiles where id=$1)+$2)`, [uid, amount]);
  await db.query(`update public.profiles set credit_balance = credit_balance + $2 where id=$1`, [uid, amount]);
}

console.log('SCENARIO 1 — free daily heart');
let r = await giveHeart(alice, photo);
ok(r.free === true && r.credits_spent === 0, `alice's 1st heart is FREE (hearts left: ${r.hearts_remaining_today})`);
ok((await q(`select hearts_remaining_today n from public.profiles where id=$1`,[alice]))[0].n === 9, 'daily allowance 10 → 9');
ok((await q(`select total_hearts n from public.photos where id=$1`,[photo]))[0].n === 1, 'photo total_hearts → 1');

console.log('\nSCENARIO 2 — 2nd heart on same photo must be paid, and alice has no credits');
await expectFail(() => giveHeart(alice, photo), 'insufficient credits', 'alice 2nd heart w/ 0 credits');

console.log('\nSCENARIO 3 — grant credits (sim purchase), then the paid heart lands');
await grantCredits(alice, 100);
r = await giveHeart(alice, photo);
ok(r.free === false && r.credits_spent === 5 && r.credit_balance === 95, `paid heart: -5 credits, balance ${r.credit_balance}`);
ok((await q(`select total_hearts n from public.photos where id=$1`,[photo]))[0].n === 2, 'photo total_hearts → 2');

console.log('\nSCENARIO 4 — cannot heart your own photo');
await expectFail(() => giveHeart(creator, photo), 'cannot heart your own photo', 'creator hearts own photo');

console.log('\nSCENARIO 5 — infinity heart gated by tier');
await grantCredits(alice, 100);
await expectFail(() => giveHeart(alice, photo, 'infinity'), 'not available for your tier', 'general-tier alice gives infinity');

console.log('\nSCENARIO 6 — gold tier can give an infinity heart (tracked separately)');
await db.query(`update public.profiles set tier='gold', tier_since=now() where id=$1`, [bob]);
await grantCredits(bob, 100);
r = await giveHeart(bob, photo, 'infinity');
ok(r.heart_type === 'infinity' && r.credits_spent === 50 && r.credit_balance === 50, `gold bob gives INFINITY: -50, balance ${r.credit_balance}`);
const pc = (await q(`select total_hearts, total_infinity_hearts from public.photos where id=$1`,[photo]))[0];
ok(pc.total_hearts === 3 && pc.total_infinity_hearts === 1, `photo: ${pc.total_hearts} total / ${pc.total_infinity_hearts} infinity (separate leaderboard)`);
ok((await q(`select infinity_hearts_given n from public.profiles where id=$1`,[bob]))[0].n === 1, 'bob.infinity_hearts_given → 1');

console.log('\nSCENARIO 7 — LEDGER RECONCILES (cached balance === sum of ledger)');
const drift = await q(`select user_id, cached_balance, ledger_balance, drift from public.ledger_reconciliation where drift <> 0`);
ok(drift.length === 0, `every profile reconciles, drift=0 (${drift.length} mismatches)`);

console.log('\nSCENARIO 8 — credit_ledger is APPEND-ONLY');
await expectFail(() => db.query(`update public.credit_ledger set delta=0 where user_id=$1`,[alice]), 'append-only', 'UPDATE a ledger row');
await expectFail(() => db.query(`delete from public.credit_ledger where user_id=$1`,[alice]), 'append-only', 'DELETE a ledger row');

console.log('\nSCENARIO 9 — per-user rate limit');
await db.query(`update public.app_config set config = jsonb_set(config,'{rateLimit,heartsPerMinute}','2') where id=1`);
const carol = (await q(`insert into auth.users (email) values ('carol@x') returning id`))[0].id;
const photo2 = (await q(`insert into public.photos (creator_id,image_url,title) values ($1,'/p/2.jpg','Neon') returning id`,[creator]))[0].id;
await grantCredits(carol, 100);
await giveHeart(carol, photo2);                         // 1 (free)
await giveHeart(carol, photo2);                          // 2 (paid)
await expectFail(() => giveHeart(carol, photo2), 'rate limit exceeded', '3rd heart within a minute (limit 2)');

console.log(`\n── RESULT: ${PASS} passed, ${FAIL} failed ──`);
console.log('\nLedger (alice) — the append-only source of truth:');
console.table(await q(`select reason, delta, balance_after from public.credit_ledger where user_id=$1 order by created_at`,[alice]));
process.exit(FAIL ? 1 : 0);
