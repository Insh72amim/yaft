const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const accounts = await prisma.account.findMany({
    include: { imports: true },
  });
  console.log(JSON.stringify(accounts, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

check().then(() => prisma.$disconnect());
