import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app, resetDb, registerAgent } from './helpers';

afterEach(resetDb);

describe('exercise catalog', () => {
  it('lists the seeded public library, sorted by name', async () => {
    const agent = await registerAgent('c1@example.com');
    const res = await agent.get('/exercises/catalog').expect(200);

    const names: string[] = res.body.data.map((e: { name: string }) => e.name);
    expect(names.length).toBeGreaterThan(30);
    expect(names).toContain('Barbell Bench Press');
    expect(names).toContain('Back Squat');

    // Sorted case-insensitively by name.
    const sorted = [...names].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    expect(names).toEqual(sorted);

    // Seed entries are public and have no owner.
    const bench = res.body.data.find(
      (e: { name: string }) => e.name === 'Barbell Bench Press'
    );
    expect(bench).toMatchObject({ is_public: true, created_by: null });
    expect(bench.primary_muscles).toContain('chest');
    expect(bench.secondary_muscles).toEqual(
      expect.arrayContaining(['triceps', 'shoulders'])
    );
  });

  it('filters by muscle across primary and secondary', async () => {
    const agent = await registerAgent('c2@example.com');

    const chest = await agent.get('/exercises/catalog?muscle=chest').expect(200);
    expect(
      chest.body.data.every(
        (e: { primary_muscles: string[]; secondary_muscles: string[] }) =>
          e.primary_muscles.includes('chest') ||
          e.secondary_muscles.includes('chest')
      )
    ).toBe(true);

    // Triceps is a secondary muscle on bench and a primary on pushdowns — both show.
    const tri = await agent.get('/exercises/catalog?muscle=triceps').expect(200);
    const triNames = tri.body.data.map((e: { name: string }) => e.name);
    expect(triNames).toContain('Triceps Pushdown'); // primary
    expect(triNames).toContain('Barbell Bench Press'); // secondary
  });

  it('filters by name search, equipment and category', async () => {
    const agent = await registerAgent('c3@example.com');

    const press = await agent
      .get('/exercises/catalog?q=press')
      .expect(200);
    expect(press.body.data.length).toBeGreaterThan(0);
    expect(
      press.body.data.every((e: { name: string }) =>
        /press/i.test(e.name)
      )
    ).toBe(true);

    const barbell = await agent
      .get('/exercises/catalog?equipment=barbell')
      .expect(200);
    expect(
      barbell.body.data.every(
        (e: { equipment: string }) => e.equipment === 'barbell'
      )
    ).toBe(true);

    const isolation = await agent
      .get('/exercises/catalog?category=isolation')
      .expect(200);
    expect(
      isolation.body.data.every(
        (e: { category: string }) => e.category === 'isolation'
      )
    ).toBe(true);
  });

  it('rejects invalid filter vocabularies', async () => {
    const agent = await registerAgent('c4@example.com');
    await agent.get('/exercises/catalog?muscle=elbow').expect(400);
    await agent.get('/exercises/catalog?equipment=resistance-band').expect(400);
    await agent.get('/exercises/catalog?category=plyometric').expect(400);
  });

  it('exposes the muscle/equipment/category taxonomy', async () => {
    const agent = await registerAgent('c5@example.com');
    const res = await agent.get('/exercises/muscles').expect(200);
    expect(res.body.data.muscles).toContain('hamstrings');
    expect(res.body.data.equipment).toContain('dumbbell');
    expect(res.body.data.categories).toEqual(['compound', 'isolation']);
  });

  it('creates a custom private entry and validates input', async () => {
    const agent = await registerAgent('c6@example.com');

    const created = await agent
      .post('/exercises/catalog')
      .send({
        name: 'Landmine Press',
        category: 'compound',
        equipment: 'barbell',
        primary_muscles: ['shoulders', 'shoulders'], // de-duped
        secondary_muscles: ['triceps', 'chest'],
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      name: 'Landmine Press',
      is_public: false,
    });
    expect(created.body.data.created_by).toBeTypeOf('number');
    expect(created.body.data.primary_muscles).toEqual(['shoulders']);

    // It shows up in the owner's catalog alongside the public seeds.
    const list = await agent.get('/exercises/catalog').expect(200);
    expect(list.body.data.map((e: { name: string }) => e.name)).toContain(
      'Landmine Press'
    );

    // At least one valid primary muscle is required; bad muscles rejected.
    await agent
      .post('/exercises/catalog')
      .send({ name: 'Mystery Lift', primary_muscles: [] })
      .expect(400);
    await agent
      .post('/exercises/catalog')
      .send({ name: 'Mystery Lift', primary_muscles: ['elbow'] })
      .expect(400);
  });

  it('scopes custom entries to their owner but shares public seeds', async () => {
    const alice = await registerAgent('ca@example.com');
    const bob = await registerAgent('cb@example.com');

    await alice
      .post('/exercises/catalog')
      .send({ name: 'Alice Special', primary_muscles: ['core'] })
      .expect(201);

    const bobList = await bob.get('/exercises/catalog').expect(200);
    const bobNames = bobList.body.data.map((e: { name: string }) => e.name);
    expect(bobNames).not.toContain('Alice Special'); // private to Alice
    expect(bobNames).toContain('Deadlift'); // public seed shared

    await request(app).get('/exercises/catalog').expect(401);
  });
});
