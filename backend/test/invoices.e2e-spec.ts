import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ClockService } from '../src/common/clock/clock.service';
import { addDays } from '../src/common/utils/date';
import { seedDatabase } from '../src/database/seed/seeder';

const USER = { email: 'reviewer@example.com', password: 'S3cure-pass!', fullname: 'Reviewer' };

describe('SimpleInvoice API (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let today: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  const newInvoice = (overrides: Record<string, unknown> = {}) => ({
    invoiceNumber: `E2E-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    invoiceDate: today,
    dueDate: addDays(today, 30),
    currency: 'AUD',
    customer: { fullname: 'Zelda Quartermain', email: 'zelda@example.com' },
    items: [{ name: 'Widget', quantity: 3, rate: 19.99 }],
    taxRate: 10,
    discount: 5,
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);

    // Fresh schema for a deterministic run.
    const ds = app.get(DataSource);
    await ds.dropDatabase();
    await ds.runMigrations();
    await app.init();

    today = app.get(ClockService).today();
    await seedDatabase(ds, USER, today, 30);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: USER.email, password: USER.password })
      .expect(200);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('auth', () => {
    it('rejects bad credentials with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: USER.email, password: 'wrong' })
        .expect(401);
      expect(res.body).toEqual({ statusCode: 401, message: 'Invalid email or password', error: 'Unauthorized' });
    });

    it('validates login input with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nope', password: '' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining(['email must be a valid email address', 'password is required']),
      );
    });

    it('sets an httpOnly, SameSite=Strict cookie that also authenticates', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: USER.email.toUpperCase(), password: USER.password })
        .expect(200);
      const cookie = ([] as string[]).concat(login.headers['set-cookie'] ?? [])[0];
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);

      const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body).toMatchObject({ email: USER.email, fullname: USER.fullname });
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it.each(['/auth/me', '/invoices', '/invoices/00000000-0000-4000-8000-000000000000'])(
      'guards %s',
      async (path) => {
        await request(app.getHttpServer()).get(path).expect(401);
        await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer garbage').expect(401);
      },
    );

    it('guards POST /invoices', async () => {
      await request(app.getHttpServer()).post('/invoices').send(newInvoice()).expect(401);
    });
  });

  describe('key workflow: create an invoice, then find it in the list', () => {
    it('creates with server-side totals and Draft status, then lists, searches and fetches it', async () => {
      const payload = newInvoice({ totalAmount: undefined });
      const created = await request(app.getHttpServer())
        .post('/invoices')
        .set(auth())
        .send(payload)
        .expect(201);

      // 3 × 19.99 = 59.97; tax 10% = 6.00 (5.997 rounded); total = 59.97 + 6.00 − 5 = 60.97
      expect(created.body).toMatchObject({
        invoiceNumber: payload.invoiceNumber,
        status: 'Draft',
        currencySymbol: 'AU$',
        invoiceSubTotal: 59.97,
        totalTax: 6,
        totalDiscount: 5,
        totalAmount: 60.97,
        totalPaid: 0,
        balanceAmount: 60.97,
        customer: { fullname: 'Zelda Quartermain', email: 'zelda@example.com' },
        items: [expect.objectContaining({ name: 'Widget', quantity: 3, rate: 19.99, amount: 59.97 })],
      });

      // Appears in the default list (newest invoice date first).
      const list = await request(app.getHttpServer())
        .get('/invoices')
        .query({ keyword: 'zelda', status: 'Draft' })
        .set(auth())
        .expect(200);
      expect(list.body.paging).toMatchObject({ page: 1, pageSize: 10, total: 1 });
      expect(list.body.data[0]).toMatchObject({
        invoiceId: created.body.invoiceId,
        invoiceNumber: payload.invoiceNumber,
        customerName: 'Zelda Quartermain',
        totalAmount: 60.97,
        status: 'Draft',
      });

      // Partial, case-insensitive search on invoice number.
      const byNumber = await request(app.getHttpServer())
        .get('/invoices')
        .query({ keyword: payload.invoiceNumber.slice(0, 12).toLowerCase() })
        .set(auth())
        .expect(200);
      expect(byNumber.body.data.map((i: { invoiceId: string }) => i.invoiceId)).toContain(created.body.invoiceId);

      const detail = await request(app.getHttpServer())
        .get(`/invoices/${created.body.invoiceId}`)
        .set(auth())
        .expect(200);
      expect(detail.body).toEqual(created.body);
    });

    it('enforces unique invoice numbers case-insensitively with 409', async () => {
      const payload = newInvoice();
      await request(app.getHttpServer()).post('/invoices').set(auth()).send(payload).expect(201);
      const dup = await request(app.getHttpServer())
        .post('/invoices')
        .set(auth())
        .send({ ...payload, invoiceNumber: payload.invoiceNumber.toLowerCase() })
        .expect(409);
      expect(dup.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
    });

    it('rejects a due date before the invoice date with the spec error shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .set(auth())
        .send(newInvoice({ dueDate: addDays(today, -1) }))
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: ['dueDate must be on or after invoiceDate'],
        error: 'Bad Request',
      });
    });

    it('rejects client-supplied status / totals', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .set(auth())
        .send(newInvoice({ status: 'Paid', totalAmount: 1 }))
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining(['property status should not exist', 'property totalAmount should not exist']),
      );
    });
  });

  describe('GET /invoices', () => {
    it('derives Overdue consistently in the filter and in each row', async () => {
      const overdue = await request(app.getHttpServer())
        .get('/invoices')
        .query({ status: 'Overdue', pageSize: 100 })
        .set(auth())
        .expect(200);
      expect(overdue.body.data.length).toBeGreaterThan(0);
      for (const row of overdue.body.data) {
        expect(row.status).toBe('Overdue');
        expect(row.dueDate < today).toBe(true);
      }

      const pending = await request(app.getHttpServer())
        .get('/invoices')
        .query({ status: 'pending', pageSize: 100 })
        .set(auth())
        .expect(200);
      for (const row of pending.body.data) {
        expect(row.status).toBe('Pending');
        expect(row.dueDate >= today).toBe(true);
      }
    });

    it('returns the Appendix A record as Overdue (stored as Pending)', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices/099ca7da-a290-40fa-93b9-1c43ae7bb887')
        .set(auth())
        .expect(200);
      expect(res.body).toMatchObject({
        invoiceNumber: 'IV1780488206995',
        totalAmount: 2180,
        totalPaid: 1451.34,
        balanceAmount: 728.66,
        status: today > '2026-07-03' ? 'Overdue' : 'Pending',
      });
    });

    it('sorts by totalAmount in both directions', async () => {
      for (const ordering of ['ASC', 'DESC'] as const) {
        const res = await request(app.getHttpServer())
          .get('/invoices')
          .query({ sortBy: 'totalAmount', ordering, pageSize: 50 })
          .set(auth())
          .expect(200);
        const amounts: number[] = res.body.data.map((r: { totalAmount: number }) => r.totalAmount);
        const sorted = [...amounts].sort((a, b) => (ordering === 'ASC' ? a - b : b - a));
        expect(amounts).toEqual(sorted);
      }
    });

    it('paginates server-side without overlap', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/invoices')
        .query({ page: 1, pageSize: 5, sortBy: 'dueDate', ordering: 'ASC' })
        .set(auth())
        .expect(200);
      const page2 = await request(app.getHttpServer())
        .get('/invoices')
        .query({ page: 2, pageSize: 5, sortBy: 'dueDate', ordering: 'ASC' })
        .set(auth())
        .expect(200);
      expect(page1.body.data).toHaveLength(5);
      expect(page1.body.paging.total).toBeGreaterThan(10);
      const ids1 = page1.body.data.map((r: { invoiceId: string }) => r.invoiceId);
      const ids2 = page2.body.data.map((r: { invoiceId: string }) => r.invoiceId);
      expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
    });

    it('filters by invoice date range', async () => {
      const fromDate = addDays(today, -30);
      const res = await request(app.getHttpServer())
        .get('/invoices')
        .query({ fromDate, toDate: today, pageSize: 100 })
        .set(auth())
        .expect(200);
      for (const row of res.body.data) {
        expect(row.invoiceDate >= fromDate && row.invoiceDate <= today).toBe(true);
      }
    });

    it.each([
      [{ pageSize: 1000 }],
      [{ page: 0 }],
      [{ sortBy: 'customerName' }],
      [{ ordering: 'sideways' }],
      [{ status: 'Cancelled' }],
      [{ fromDate: '2026-13-01' }],
      [{ fromDate: '2026-06-10', toDate: '2026-06-01' }],
    ])('rejects invalid query %j with 400', async (query) => {
      const res = await request(app.getHttpServer()).get('/invoices').query(query).set(auth()).expect(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });

  describe('GET /invoices/:id', () => {
    it('returns 404 in the spec shape for an unknown id', async () => {
      const res = await request(app.getHttpServer())
        .get('/invoices/00000000-0000-4000-8000-000000000000')
        .set(auth())
        .expect(404);
      expect(res.body).toEqual({ statusCode: 404, message: 'Invoice not found', error: 'Not Found' });
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer()).get('/invoices/not-a-uuid').set(auth()).expect(400);
    });
  });

  it('serves Swagger JSON documenting every endpoint', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/auth/me', '/invoices', '/invoices/{id}']),
    );
  });
});
