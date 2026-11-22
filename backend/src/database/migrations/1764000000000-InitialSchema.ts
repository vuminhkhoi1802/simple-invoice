import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1764000000000 implements MigrationInterface {
  name = 'InitialSchema1764000000000';

  public async up(q: QueryRunner): Promise<void> {
    // Trigram indexes make the partial, case-insensitive ILIKE search index-assisted.
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await q.query(`
      CREATE TABLE users (
        id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        email         varchar(255) NOT NULL,
        password_hash varchar(255) NOT NULL,
        fullname      varchar(255) NOT NULL,
        created_at    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT ck_users_email_lowercase CHECK (email = lower(email))
      )`);

    // Overdue is intentionally NOT part of this enum: it is derived at read time.
    await q.query(`CREATE TYPE invoice_status AS ENUM ('Draft', 'Pending', 'Paid')`);

    await q.query(`
      CREATE TABLE invoices (
        id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number         varchar(50)   NOT NULL,
        invoice_reference      varchar(100),
        invoice_date           date          NOT NULL,
        due_date               date          NOT NULL,
        currency               char(3)       NOT NULL,
        currency_symbol        varchar(8)    NOT NULL,
        description            text,
        status                 invoice_status NOT NULL DEFAULT 'Draft',
        customer_fullname      varchar(255)  NOT NULL,
        customer_email         varchar(255)  NOT NULL,
        customer_mobile_number varchar(50),
        customer_address       text,
        tax_rate               numeric(5,2)  NOT NULL DEFAULT 10,
        invoice_sub_total      numeric(14,2) NOT NULL,
        total_tax              numeric(14,2) NOT NULL,
        total_discount         numeric(14,2) NOT NULL DEFAULT 0,
        total_amount           numeric(14,2) NOT NULL,
        total_paid             numeric(14,2) NOT NULL DEFAULT 0,
        balance_amount         numeric(14,2) NOT NULL,
        created_at             timestamptz   NOT NULL DEFAULT now(),
        created_by             uuid          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_invoices_due_after_invoice CHECK (due_date >= invoice_date),
        CONSTRAINT ck_invoices_number_not_blank  CHECK (length(btrim(invoice_number)) > 0),
        CONSTRAINT ck_invoices_currency_format   CHECK (currency ~ '^[A-Z]{3}$'),
        CONSTRAINT ck_invoices_tax_rate          CHECK (tax_rate >= 0),
        CONSTRAINT ck_invoices_amounts_non_negative CHECK (
          invoice_sub_total >= 0 AND total_tax >= 0 AND total_discount >= 0
          AND total_amount >= 0 AND total_paid >= 0
        ),
        CONSTRAINT ck_invoices_total_formula   CHECK (total_amount = invoice_sub_total + total_tax - total_discount),
        CONSTRAINT ck_invoices_balance_formula CHECK (balance_amount = total_amount - total_paid)
      )`);

    // Uniqueness is case-insensitive: "INV-001" and "inv-001" are the same invoice to a human.
    await q.query(
      `CREATE UNIQUE INDEX uq_invoices_invoice_number ON invoices (lower(invoice_number))`,
    );
    await q.query(`CREATE INDEX ix_invoices_status_due_date ON invoices (status, due_date)`);
    await q.query(`CREATE INDEX ix_invoices_invoice_date ON invoices (invoice_date)`);
    await q.query(`CREATE INDEX ix_invoices_due_date ON invoices (due_date)`);
    await q.query(`CREATE INDEX ix_invoices_total_amount ON invoices (total_amount)`);
    await q.query(`CREATE INDEX ix_invoices_created_by ON invoices (created_by)`);
    await q.query(
      `CREATE INDEX ix_invoices_invoice_number_trgm ON invoices USING gin (invoice_number gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX ix_invoices_customer_fullname_trgm ON invoices USING gin (customer_fullname gin_trgm_ops)`,
    );

    await q.query(`
      CREATE TABLE invoice_items (
        id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id uuid          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        name       varchar(255)  NOT NULL,
        quantity   integer       NOT NULL,
        rate       numeric(14,2) NOT NULL,
        amount     numeric(14,2) NOT NULL,
        position   smallint      NOT NULL DEFAULT 0,
        CONSTRAINT ck_invoice_items_quantity_positive CHECK (quantity > 0),
        CONSTRAINT ck_invoice_items_rate_positive     CHECK (rate > 0),
        CONSTRAINT ck_invoice_items_name_not_blank    CHECK (length(btrim(name)) > 0)
      )`);
    await q.query(`CREATE INDEX ix_invoice_items_invoice_id ON invoice_items (invoice_id, position)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS invoice_items`);
    await q.query(`DROP TABLE IF EXISTS invoices`);
    await q.query(`DROP TYPE IF EXISTS invoice_status`);
    await q.query(`DROP TABLE IF EXISTS users`);
  }
}
