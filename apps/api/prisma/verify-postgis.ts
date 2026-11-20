import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== PostGIS Verification & Query Plan ===\n');

  // 1. Check PostGIS version
  const version = await prisma.$queryRaw<Array<{ postgis_full_version: string }>>`
    SELECT postgis_full_version();
  `;
  console.log('PostGIS Version:\n', version[0]?.postgis_full_version, '\n');

  // 2. Count seeded records
  const driverCount = await prisma.driver.count();
  const requestCount = await prisma.deliveryRequest.count();
  const userCount = await prisma.user.count();

  console.log(`Record counts in database:`);
  console.log(`- Drivers: ${driverCount}`);
  console.log(`- Requests: ${requestCount}`);
  console.log(`- Users: ${userCount}\n`);

  // 3. Inspect indexes on Driver table
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Driver'
    ORDER BY indexname;
  `;
  console.log('Driver Table Indexes:');
  indexes.forEach((idx) => {
    console.log(`- ${idx.indexname}: ${idx.indexdef}`);
  });
  console.log('');

  // 4. Force index usage check with EXPLAIN
  // Central Bengaluru point (lng: 77.5946, lat: 12.9716), radius 5000 meters (5 km)
  // Disable seqscan in this transaction to confirm index availability and execution plan
  await prisma.$executeRawUnsafe('SET enable_seqscan = OFF;');

  const explainPlan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
    EXPLAIN (ANALYZE, COSTS, BUFFERS)
    SELECT id, name, status, rating, lat, lng,
           ST_Distance(location, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography) AS distance_meters
    FROM "Driver"
    WHERE ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography,
      5000
    )
    ORDER BY distance_meters ASC
    LIMIT 10;
  `;

  console.log('EXPLAIN (ANALYZE, COSTS, BUFFERS) Output:');
  explainPlan.forEach((row) => {
    console.log(row['QUERY PLAN']);
  });

  // Re-enable seqscan
  await prisma.$executeRawUnsafe('SET enable_seqscan = ON;');

  console.log('\n=== Verification Successful ===');
}

verify()
  .catch((e) => {
    console.error('Verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
