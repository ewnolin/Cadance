import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

type Agent = ReturnType<typeof request.agent>;

async function catalogId(agent: Agent, q: string): Promise<number> {
  const res = await agent
    .get(`/exercises/catalog?q=${encodeURIComponent(q)}`)
    .expect(200);
  return res.body.data[0].id as number;
}

/** Create a template for `agent`, optionally published. Returns its id. */
async function makeTemplate(
  agent: Agent,
  body: Record<string, unknown>,
  publish = false
): Promise<number> {
  const created = await agent.post('/workout-templates').send(body).expect(201);
  const id = created.body.data.id as number;
  if (publish) await agent.post(`/workout-templates/${id}/publish`).expect(200);
  return id;
}

describe('profiles', () => {
  it('creates a default profile on registration and updates it', async () => {
    const agent = await registerAgent('p1@example.com');

    const me = await agent.get('/profile').expect(200);
    expect(me.body.data.display_name).toMatch(/^Lifter \d+$/);
    expect(me.body.data.bio).toBeNull();

    const updated = await agent
      .put('/profile')
      .send({ display_name: 'Strong Hannah', bio: 'PPL enjoyer' })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      display_name: 'Strong Hannah',
      bio: 'PPL enjoyer',
    });

    await agent.put('/profile').send({ display_name: '   ' }).expect(400);
    await request(app).get('/profile').expect(401);
  });
});

describe('public library', () => {
  it('requires authentication', async () => {
    await request(app).get('/library').expect(401);
  });

  it('only lists published templates, with author attribution and muscles', async () => {
    const alice = await registerAgent('la@example.com');
    await alice.put('/profile').send({ display_name: 'Coach Alice' }).expect(200);
    const bob = await registerAgent('lb@example.com');

    const squatId = await catalogId(alice, 'Back Squat'); // primary: quads
    await makeTemplate(
      alice,
      {
        name: 'Leg Power',
        exercises: [{ name: 'Back Squat', catalog_id: squatId, target_sets: 5 }],
      },
      true
    );
    // A second, unpublished template stays private.
    await makeTemplate(alice, { name: 'Secret Day' }, false);

    const lib = await bob.get('/library').expect(200);
    expect(lib.body.data).toHaveLength(1);
    const entry = lib.body.data[0];
    expect(entry.name).toBe('Leg Power');
    expect(entry.is_public).toBe(true);
    expect(entry.author).toMatchObject({ display_name: 'Coach Alice', user_id: expect.any(Number) });
    expect(entry.muscles).toContain('quads');
    // Never leak the author's email through attribution.
    expect(JSON.stringify(entry.author)).not.toContain('@');
  });

  it('filters by muscle and name', async () => {
    const alice = await registerAgent('lc@example.com');
    const bench = await catalogId(alice, 'Barbell Bench Press'); // chest
    const curl = await catalogId(alice, 'Barbell Curl'); // biceps

    await makeTemplate(
      alice,
      { name: 'Chest Focus', exercises: [{ name: 'Bench', catalog_id: bench }] },
      true
    );
    await makeTemplate(
      alice,
      { name: 'Arm Day', exercises: [{ name: 'Curl', catalog_id: curl }] },
      true
    );

    const chest = await alice.get('/library?muscle=chest').expect(200);
    expect(chest.body.data.map((t: { name: string }) => t.name)).toEqual(['Chest Focus']);

    const named = await alice.get('/library?q=arm').expect(200);
    expect(named.body.data.map((t: { name: string }) => t.name)).toEqual(['Arm Day']);

    await alice.get('/library?muscle=tendon').expect(400);
  });

  it('unpublishing removes a template from the library', async () => {
    const alice = await registerAgent('ld@example.com');
    const id = await makeTemplate(alice, { name: 'On Then Off' }, true);

    await alice.get(`/library/${id}`).expect(200);
    await alice.post(`/workout-templates/${id}/unpublish`).expect(200);
    await alice.get(`/library/${id}`).expect(404);
    const lib = await alice.get('/library').expect(200);
    expect(lib.body.data).toHaveLength(0);
  });

  it("cannot publish another user's template", async () => {
    const alice = await registerAgent('le@example.com');
    const bob = await registerAgent('lf@example.com');
    const id = await makeTemplate(alice, { name: 'Mine' }, false);

    await bob.post(`/workout-templates/${id}/publish`).expect(404);
    const lib = await bob.get('/library').expect(200);
    expect(lib.body.data).toHaveLength(0);
  });

  it('copies a published template into the copier\'s own templates', async () => {
    const alice = await registerAgent('lg@example.com');
    const bob = await registerAgent('lh@example.com');
    const squatId = await catalogId(alice, 'Back Squat');
    const srcId = await makeTemplate(
      alice,
      {
        name: 'Borrowable',
        notes: 'take it',
        exercises: [{ name: 'Back Squat', catalog_id: squatId, target_sets: 4, target_reps: '5' }],
      },
      true
    );

    const copy = await bob.post(`/library/${srcId}/copy`).expect(201);
    expect(copy.body.data).toMatchObject({ name: 'Borrowable', notes: 'take it', is_public: false });
    expect(copy.body.data.exercises[0]).toMatchObject({
      name: 'Back Squat',
      catalog_id: squatId,
      target_sets: 4,
      target_reps: '5',
    });

    // It's now Bob's own template, and the copy is private (not re-listed publicly).
    const bobTemplates = await bob.get('/workout-templates').expect(200);
    expect(bobTemplates.body.data.map((t: { name: string }) => t.name)).toContain('Borrowable');
    const bobCopyId = copy.body.data.id;
    await bob.get(`/library/${bobCopyId}`).expect(404);
  });

  it('cannot copy a non-public template', async () => {
    const alice = await registerAgent('li@example.com');
    const bob = await registerAgent('lj@example.com');
    const id = await makeTemplate(alice, { name: 'Private' }, false);

    await bob.post(`/library/${id}/copy`).expect(404);
  });

  it('includes the profile in the GDPR export', async () => {
    const agent = await registerAgent('lk@example.com');
    await agent.put('/profile').send({ display_name: 'Exported Me' }).expect(200);

    const dump = await agent.get('/account/export').expect(200);
    expect(dump.body.data.profile.display_name).toBe('Exported Me');
  });
});
