// Authentic Indian customer names for realistic dispatcher experience
export const CUSTOMER_NAMES = [
  'Ananya Sharma',
  'Rahul Verma',
  'Priya Nair',
  'Aditya Rao',
  'Sneha Patel',
  'Vikram Malhotra',
  'Kavya Iyer',
  'Arjun Reddy',
  'Rohan Mehta',
  'Neha Gupta',
  'Pooja Hegde',
  'Siddharth Jain',
  'Divya Menon',
  'Karan Singhal',
  'Meera Nambiar',
  'Tarun Pillai',
  'Ishita Sen',
  'Abhishek Das',
  'Shreya Kulkarni',
  'Gaurav Bhat',
  'Deepa Narayan',
  'Harish Chandra',
  'Varun Kapoor',
  'Ritu Aggarwal',
  'Sunita Rao',
  'Nikhil Joshi',
  'Aishwarya Nair',
  'Manish Pandey',
  'Lavanya Sundaram',
  'Sanjay Dutt',
];

// Realistic parcel/package types
export const PACKAGE_TYPES = [
  'Express Parcel',
  'Organic Groceries',
  'Pharmacy & Medicine',
  'Gourmet Food Delivery',
  'Office Electronics',
  'Specialty Coffee',
  'Urgent Documents',
  'Fresh Florals',
  'Fashion & Apparel',
  'Home Essentials',
];

// Major Bengaluru landmarks and neighborhoods
export const BENGALURU_HUBS = [
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
  { name: 'Rajajinagar', lat: 12.9982, lng: 77.5530 },
  { name: 'JP Nagar', lat: 12.9063, lng: 77.5857 },
  { name: 'Banashankari', lat: 12.9255, lng: 77.5468 },
  { name: 'Bellandur', lat: 12.9304, lng: 77.6784 },
  { name: 'Sadashivanagar', lat: 13.0068, lng: 77.5813 },
  { name: 'Frazer Town', lat: 12.9968, lng: 77.6131 },
  { name: 'BTM Layout', lat: 12.9166, lng: 77.6101 },
  { name: 'Yeshwanthpur', lat: 13.0238, lng: 77.5484 },
];

export const REAL_DRIVER_NAMES = [
  'Rajesh Kumar',
  'Suresh Pillai',
  'Ramesh Babu',
  'Amit Sharma',
  'Vikram Singh',
  'Deepak Rao',
  'Sanjay Patel',
  'Sunil Gowda',
  'Praveen Joshi',
  'Karthik Raja',
  'Naveen Kumar',
  'Vijay Reddy',
  'Santosh Murthy',
  'Anand Verma',
  'Ganesh Iyer',
  'Mahesh Yadav',
  'Ashok Shetty',
  'Bharath Gowda',
  'Chandan Rao',
  'Darshan Kumar',
  'Chethan Gowda',
  'Lokesh Murthy',
  'Mohan Das',
  'Nikhil Sharma',
  'Pawan Verma',
  'Rakesh Nair',
  'Shankar Pillai',
  'Yogesh Joshi',
  'Raghu Ram',
  'Harish Babu',
  'Girish Patel',
  'Manjunath Gowda',
  'Venkatesh Prasad',
  'Prashant Kumar',
  'Arun Menon',
  'Rohit Verma',
  'Manoj Tiwari',
  'Kiran Kumar',
  'Pradeep Shenoy',
  'Dinesh Gowda',
  'Siddharth Hegde',
  'Abhishek Bhat',
  'Varun Rao',
  'Suraj Nair',
  'Hemant Deshmukh',
  'Alok Pandey',
  'Gautam Sen',
  'Tarun Kulkarni',
  'Sachin Joshi',
  'Ajay Reddy',
];

/**
 * Deterministic string hash (DJB2) to keep customer & package names consistent
 * per delivery request ID.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get customer name associated with a request ID.
 */
export function getCustomerName(requestId?: string | null): string {
  if (!requestId) return 'Customer';
  const hash = hashString(requestId);
  return CUSTOMER_NAMES[hash % CUSTOMER_NAMES.length]!;
}

/**
 * Get package description for a request ID.
 */
export function getPackageType(requestId?: string | null): string {
  if (!requestId) return 'Standard Parcel';
  const hash = hashString(requestId + '-pkg');
  return PACKAGE_TYPES[hash % PACKAGE_TYPES.length]!;
}

/**
 * Find nearest Bengaluru neighborhood / landmark to coordinates.
 */
export function getNeighborhoodName(lat: number, lng: number): string {
  let closestHub = BENGALURU_HUBS[0]!;
  let minDistance = Infinity;

  for (const hub of BENGALURU_HUBS) {
    const dLat = lat - hub.lat;
    const dLng = lng - hub.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      closestHub = hub;
    }
  }

  return closestHub.name;
}

/**
 * Format driver name: transforms any generic 'Sim Driver' or test name into a real driver name.
 */
export function getFormattedDriverName(driverName?: string | null, driverId?: string | null): string {
  if (
    driverName &&
    !driverName.toLowerCase().includes('sim') &&
    !driverName.toLowerCase().includes('supertest') &&
    !driverName.toLowerCase().includes('test')
  ) {
    return driverName;
  }
  const seed = driverId || driverName || 'default-driver';
  const hash = hashString(seed);
  return REAL_DRIVER_NAMES[hash % REAL_DRIVER_NAMES.length]!;
}

/**
 * Format driver phone: transforms dummy sim phones like +919900001089 into realistic mobile numbers.
 */
export function getFormattedDriverPhone(phone?: string | null, driverId?: string | null): string {
  if (phone && !phone.startsWith('+91990000') && !phone.startsWith('+91998877')) {
    return phone;
  }
  const seed = (driverId || phone || 'driver') + '-phone';
  const hash = hashString(seed);
  const part1 = 98100 + (hash % 899);
  const part2 = 10000 + ((hash >> 3) % 89999);
  return `+91 ${part1} ${part2}`;
}
