const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync('./industries.json', 'utf-8'));

  for (const industry of data) {
    await prisma.industry.create({
      data: {
        industry_id: industry.industry_id,
        display_name: industry.display_name,
        cleaned_name: industry.cleaned_name,
      },
    });
  }
  console.log('Seed data inserted successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
