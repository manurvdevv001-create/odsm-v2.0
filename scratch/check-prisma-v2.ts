import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    // Accessing DMMF to see the model definition as the client sees it
    const dmmf = (prisma as any)._baseClient._dmmf;
    const staffProfile = dmmf.modelMap.StaffProfile;
    console.log('--- FIELDS ---');
    console.log(staffProfile.fields.map((f: any) => f.name).join(', '));
    process.exit(0);
}

check();
