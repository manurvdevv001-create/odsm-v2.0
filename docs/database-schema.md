# Database schema updates

The production application uses Prisma Client against Turso, but generating the client does not update the remote database schema. Apply the additive PersonContact schema change once from a deployment shell where `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are configured:

```sh
npm run migrate:person-contacts
```

The command creates the shared-contact table and indexes and adds nullable contact and guardian postname columns. It is safe to rerun and does not rewrite, normalize, merge, or delete existing records. Review and resolve historical phone-number conflicts separately with:

```sh
npm run audit:person-contacts
```

Do not run Prisma `db push` against production as a substitute for this targeted migration; it may apply unrelated schema changes.
