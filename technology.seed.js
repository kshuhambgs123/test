// const { PrismaClient } = require('@prisma/client');
// const fs = require('fs');
// const parse = require('csv-parse/sync');

// const prisma = new PrismaClient();

// async function main() {
//   const fileContent = fs.readFileSync('./supported_technologies.csv', 'utf-8');

//   // Parse CSV into array of rows
//   const records = parse.parse(fileContent, {
//     columns: true,
//     skip_empty_lines: true,
//   });

//   for (const row of records) {
//     // console.log("Fg : ", row);
//     const cat = row.Category.trim();
//     const tech = row.Technology.trim();

//     const createdTech = await prisma.technology.create({
//       data: { category: cat , display_name: tech },
//     });
//   }
//   console.log('CSV seed data inserted successfully.');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
