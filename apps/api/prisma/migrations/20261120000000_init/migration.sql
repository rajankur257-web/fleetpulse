-- Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dispatcher', 'driver');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('available', 'busy', 'offline');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'offered', 'assigned', 'picked_up', 'delivered', 'cancelled', 'expired');

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'driver',
    "driverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Driver
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'offline',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "lastLocationAt" TIMESTAMP(3),
    "activeRequestId" TEXT,
    "dailyTrips" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DeliveryRequest
CREATE TABLE "DeliveryRequest" (
    "id" TEXT NOT NULL,
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "dropLat" DOUBLE PRECISION NOT NULL,
    "dropLng" DOUBLE PRECISION NOT NULL,
    "pickupLocation" geography(Point, 4326),
    "dropLocation" geography(Point, 4326),
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "assignedDriverId" TEXT,
    "offeredAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DispatchEvent
CREATE TABLE "DispatchEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "driverId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "User_driverId_key" ON "User"("driverId");

-- CreateIndex: User
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex: Driver Spatial GiST & BTree
CREATE INDEX "Driver_location_idx" ON "Driver" USING GIST ("location");
CREATE INDEX "Driver_status_idx" ON "Driver"("status");
CREATE INDEX "Driver_createdAt_idx" ON "Driver"("createdAt");

-- CreateIndex: DeliveryRequest Spatial GiST & BTree
CREATE INDEX "DeliveryRequest_pickupLocation_idx" ON "DeliveryRequest" USING GIST ("pickupLocation");
CREATE INDEX "DeliveryRequest_dropLocation_idx" ON "DeliveryRequest" USING GIST ("dropLocation");
CREATE INDEX "DeliveryRequest_status_idx" ON "DeliveryRequest"("status");
CREATE INDEX "DeliveryRequest_createdAt_idx" ON "DeliveryRequest"("createdAt");
CREATE INDEX "DeliveryRequest_assignedDriverId_idx" ON "DeliveryRequest"("assignedDriverId");

-- CreateIndex: DispatchEvent BTree
CREATE INDEX "DispatchEvent_requestId_idx" ON "DispatchEvent"("requestId");
CREATE INDEX "DispatchEvent_driverId_idx" ON "DispatchEvent"("driverId");
CREATE INDEX "DispatchEvent_type_idx" ON "DispatchEvent"("type");
CREATE INDEX "DispatchEvent_createdAt_idx" ON "DispatchEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRequest" ADD CONSTRAINT "DeliveryRequest_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchEvent" ADD CONSTRAINT "DispatchEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchEvent" ADD CONSTRAINT "DispatchEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Triggers to auto-populate geography location points from lat/lng
CREATE OR REPLACE FUNCTION update_driver_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_driver_location
BEFORE INSERT OR UPDATE OF lat, lng ON "Driver"
FOR EACH ROW
EXECUTE FUNCTION update_driver_location();

CREATE OR REPLACE FUNCTION update_request_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW."pickupLocation" := ST_SetSRID(ST_MakePoint(NEW."pickupLng", NEW."pickupLat"), 4326)::geography;
    NEW."dropLocation" := ST_SetSRID(ST_MakePoint(NEW."dropLng", NEW."dropLat"), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_request_location
BEFORE INSERT OR UPDATE OF "pickupLat", "pickupLng", "dropLat", "dropLng" ON "DeliveryRequest"
FOR EACH ROW
EXECUTE FUNCTION update_request_location();
