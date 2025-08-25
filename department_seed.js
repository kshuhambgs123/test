  const { PrismaClient } = require('@prisma/client');
  const fs = require('fs');
  
  const prisma = new PrismaClient();
  
  async function main() {
    const data = JSON.parse(fs.readFileSync('./departments.json', 'utf-8'));

    for (const department of data) {
        // Create department
        const createdDepartment = await prisma.department.create({
        data: {
            name: department.name,
        },
        });

        // Create job functions
        for (const job of department.children) {
        await prisma.jobFunction.create({
            data: {
            name: job.name,
            departmentId: createdDepartment.id,
            },
        });
        }
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
  