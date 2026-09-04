import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const login = "PRF-26-0004";
  const schoolMatricule = "67AM3C";
  
  console.log(`--- Checking for User: ${login} in School: ${schoolMatricule} ---`);

  // Check User Model
  const userModel = await prisma.user.findFirst({
    where: { 
        OR: [
            { username: login },
            { name: { contains: login } }
        ]
    },
    include: { profile: true }
  });

  if (userModel) {
    console.log("Found in User Model:");
    console.log(JSON.stringify(userModel, null, 2));
  } else {
    console.log("Not found in User Model.");
  }

  // Check School Records
  const school = await prisma.school.findUnique({
    where: { matricule: schoolMatricule }
  });

  if (school) {
    console.log(`\nSchool Found: ${school.name}`);
    let users = [];
    try {
      users = JSON.parse(school.users || "[]");
    } catch (e) {
      console.log("Error parsing school.users JSON");
    }
    
    const found = users.find((u: any) => u.login === login);
    if (found) {
      console.log("Found in School.users JSON:");
      console.log(JSON.stringify(found, null, 2));
    } else {
      console.log("Not found in School.users JSON.");
      console.log("Available users in this school:", users.map((u: any) => u.login).join(", "));
    }
  } else {
    console.log("\nSchool '67AM3C' not found.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
