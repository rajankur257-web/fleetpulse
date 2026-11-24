import process from 'node:process';
import { PrismaClient, DriverStatus, RequestStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Center of Bengaluru
const BENGALURU_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
};

// Major hubs in Bengaluru for realistic distribution
const HUBS = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7500 },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
  { name: 'Jayanagar', lat: 12.9308, lng: 77.5838 },
  { name: 'MG Road', lat: 12.9756, lng: 77.6066 },
  { name: 'Malleshwaram', lat: 13.0031, lng: 77.5643 },
  { name: 'Marathahalli', lat: 12.9591, lng: 77.6974 },
  { name: 'Hebbal', lat: 13.0358, lng: 77.5970 },
];

function getRandomOffset(radiusKm: number) {
  // Approximate 1 deg latitude ~ 111 km, 1 deg longitude ~ 111 * cos(lat) km
  const r = radiusKm / 111;
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const dLat = w * Math.cos(t);
  const dLng = (w * Math.sin(t)) / Math.cos((BENGALURU_CENTER.lat * Math.PI) / 180);
  return { dLat, dLng };
}

async function main() {
  console.log('Seeding Fleet Pulse database with Bengaluru fleet data...');

  // 1. Create Default Users (Admin, Dispatcher)
  // Default password: Admin@123456
  const DEFAULT_PASSWORD_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$uvSkNr76jR4oL3NtV1LC/w$E7Ey5UiAI0sx80SoZXny9WEYS0Bgi9FbhD/klV3kj1c';

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@fleetpulse.com' },
    update: { passwordHash: DEFAULT_PASSWORD_HASH },
    create: {
      email: 'admin@fleetpulse.com',
      name: 'System Admin',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.admin,
    },
  });

  const dispatcherUser = await prisma.user.upsert({
    where: { email: 'dispatcher@fleetpulse.com' },
    update: { passwordHash: DEFAULT_PASSWORD_HASH },
    create: {
      email: 'dispatcher@fleetpulse.com',
      name: 'Central Dispatcher',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.dispatcher,
    },
  });

  console.log(`Created admin (${adminUser.email}) and dispatcher (${dispatcherUser.email})`);

  // 2. Create 50 Drivers in and around Bengaluru
  const firstNames = [
    'Aarav', 'Vihaan', 'Aditya', 'Sai', 'Reyansh', 'Arjun', 'Kabir', 'Rohan',
    'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Pari', 'Saanvi', 'Aditi', 'Kavya',
    'Naveen', 'Karthik', 'Suresh', 'Ramesh', 'Manjunath', 'Venkatesh', 'Chethan',
    'Praveen', 'Raghu', 'Harish', 'Girish', 'Deepak', 'Sanjay', 'Sunil',
    'Prashant', 'Vijay', 'Santosh', 'Anand', 'Ganesh', 'Mahesh', 'Rajesh',
    'Ashok', 'Bharath', 'Chandan', 'Darshan', 'Gowda', 'Kumar', 'Lokesh',
    'Mohan', 'Nikhil', 'Pawan', 'Rakesh', 'Shankar', 'Yogesh',
  ];

  const driverStatuses: DriverStatus[] = [
    ...Array(35).fill(DriverStatus.available),
    ...Array(10).fill(DriverStatus.busy),
    ...Array(5).fill(DriverStatus.offline),
  ];

  const createdDrivers = [];

  for (let i = 0; i < 50; i++) {
    const hub = HUBS[i % HUBS.length]!;
    const offset = getRandomOffset(3.5); // within 3.5 km of hub
    const lat = Number((hub.lat + offset.dLat).toFixed(6));
    const lng = Number((hub.lng + offset.dLng).toFixed(6));
    const status = driverStatuses[i] ?? DriverStatus.available;
    const rating = Number((4.2 + Math.random() * 0.8).toFixed(1));
    const dailyTrips = Math.floor(Math.random() * 8);

    const driver = await prisma.driver.create({
      data: {
        name: `${firstNames[i]} Kumar`,
        phone: `+91 98${String(10000000 + i * 1423).slice(0, 8)}`,
        status,
        rating,
        lat,
        lng,
        dailyTrips,
        lastLocationAt: new Date(),
      },
    });

    createdDrivers.push(driver);
  }

  console.log(`Seeded ${createdDrivers.length} drivers in Bengaluru.`);

  // 3. Create 20 Delivery Requests
  const requestStatuses: RequestStatus[] = [
    ...Array(15).fill(RequestStatus.pending),
    ...Array(3).fill(RequestStatus.assigned),
    ...Array(2).fill(RequestStatus.delivered),
  ];

  for (let i = 0; i < 20; i++) {
    const pickupHub = HUBS[i % HUBS.length]!;
    const dropHub = HUBS[(i + 3) % HUBS.length]!;

    const pOffset = getRandomOffset(2.0);
    const dOffset = getRandomOffset(2.0);

    const pickupLat = Number((pickupHub.lat + pOffset.dLat).toFixed(6));
    const pickupLng = Number((pickupHub.lng + pOffset.dLng).toFixed(6));
    const dropLat = Number((dropHub.lat + dOffset.dLat).toFixed(6));
    const dropLng = Number((dropHub.lng + dOffset.dLng).toFixed(6));

    const status = requestStatuses[i] ?? RequestStatus.pending;
    const priority = (i % 3) + 1;
    const assignedDriverId =
      status === RequestStatus.assigned || status === RequestStatus.delivered
        ? createdDrivers[i]?.id
        : null;

    await prisma.deliveryRequest.create({
      data: {
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        status,
        priority,
        assignedDriverId,
        assignedAt: assignedDriverId ? new Date() : null,
        completedAt: status === RequestStatus.delivered ? new Date() : null,
      },
    });
  }

  console.log(`Seeded 20 delivery requests across Bengaluru.`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
