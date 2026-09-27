# Database schema updates

The production application uses Prisma Client against Turso. Generating the client does not update the remote database schema. At application startup, the Node.js instrumentation applies the additive PersonContact schema change using the existing `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables. No deployment shell is required.

For a manual run, a local environment with the Turso credentials can also execute:

```sh
npm run migrate:person-contacts
```

The migration creates the shared-contact table and indexes and adds nullable contact and guardian postname columns. It is safe to rerun and does not rewrite, normalize, merge, or delete existing records. Review and resolve historical phone-number conflicts separately with:

```sh
npm run audit:person-contacts
```

Do not run Prisma `db push` against production as a substitute for this targeted migration; it may apply unrelated schema changes.
