import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SimulatorService } from '../modules/simulator/simulator.service';

function parseArg(argName: string, defaultValue: number): number {
  const match = process.argv.find((a) => a.startsWith(`--${argName}=`));
  if (match) {
    const val = Number(match.split('=')[1]);
    if (!isNaN(val)) return val;
  }
  return defaultValue;
}

async function bootstrap() {
  const driverCount = parseArg('drivers', 100);
  const speedMultiplier = parseArg('multiplier', 10);
  const durationSeconds = parseArg('duration', 300); // 5 minutes default
  const requestRate = parseArg('rate', 20);
  const seed = parseArg('seed', 42);
  const acceptProb = parseArg('accept', 0.8);

  console.log('================================================================');
  console.log('            FLEET PULSE: HIGH-CONCURRENCY FLEET SIMULATOR       ');
  console.log('================================================================');
  console.log(`Drivers:            ${driverCount}`);
  console.log(`Speed Multiplier:   ${speedMultiplier}x`);
  console.log(`Duration:           ${durationSeconds}s (${(durationSeconds / 60).toFixed(1)} min)`);
  console.log(`Request Rate:       ${requestRate} req/min`);
  console.log(`Accept Probability: ${acceptProb * 100}%`);
  console.log(`Seed:               ${seed}`);
  console.log('----------------------------------------------------------------');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api/v1');
  const server = await app.listen(0);
  const port = server.address().port;
  const socketUrl = `http://127.0.0.1:${port}`;

  const simulator = app.get(SimulatorService);

  const stats = await simulator.start({
    driverCount,
    speedMultiplier,
    durationSeconds,
    requestRatePerMinute: requestRate,
    acceptProbability: acceptProb,
    seed,
    socketUrl,
  });

  console.log(`Simulator successfully initialized with ${stats.driverCount} drivers.`);
  console.log('Running simulation loop...');

  let seconds = 0;
  const interval = setInterval(() => {
    seconds += 2;
    const current = simulator.getStatus();
    const mm = String(Math.floor(current.elapsedSeconds / 60)).padStart(2, '0');
    const ss = String(current.elapsedSeconds % 60).padStart(2, '0');

    process.stdout.write(
      `\r[Sim ${mm}:${ss}] Drivers: ${current.driverCount} (Avail: ${current.availableDrivers}, Busy: ${current.busyDrivers}) | Reqs: Created=${current.requestsCreated}, Assigned=${current.requestsAssigned}, Done=${current.requestsCompleted} | DoubleAssigns: ${current.doubleAssignmentsDetected}`,
    );

    if (seconds >= durationSeconds) {
      clearInterval(interval);
      shutdown(simulator, app).catch((e) => console.error('Shutdown error:', e));
    }
  }, 2000);

  let shuttingDown = false;
  const shutdown = async (sim: SimulatorService, nestApp: INestApplication) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(interval);
    console.log('\n\nFinalizing simulation...');
    const finalStats = await sim.stop();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      await nestApp.close();
    } catch {
      // Suppress graceful shutdown cleanup warnings
    }

    console.log('\n================================================================');
    console.log('                   SIMULATION RUN REPORT                        ');
    console.log('================================================================');
    console.log(`Elapsed Time:               ${finalStats.elapsedSeconds}s`);
    console.log(`Total Drivers:              ${finalStats.driverCount}`);
    console.log(`Requests Created:           ${finalStats.requestsCreated}`);
    console.log(`Requests Assigned:          ${finalStats.requestsAssigned}`);
    console.log(`Requests Completed:         ${finalStats.requestsCompleted}`);
    console.log(`Requests Expired:           ${finalStats.requestsExpired}`);
    console.log(`Double Assignments:         ${finalStats.doubleAssignmentsDetected}`);
    console.log('----------------------------------------------------------------');
    if (finalStats.doubleAssignmentsDetected === 0) {
      console.log('RESULT: PASSED (ZERO DOUBLE ASSIGNMENTS VERIFIED)');
    } else {
      console.error(`RESULT: FAILED (${finalStats.doubleAssignmentsDetected} DOUBLE ASSIGNMENTS DETECTED)`);
      process.exit(1);
    }
    console.log('================================================================\n');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown(simulator, app));
  process.on('SIGTERM', () => shutdown(simulator, app));
}

bootstrap().catch((err) => {
  console.error('Fatal simulator error:', err);
  process.exit(1);
});
