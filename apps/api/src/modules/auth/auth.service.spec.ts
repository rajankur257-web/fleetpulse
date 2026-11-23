import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '@fleet-pulse/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService (M10: Auth & Security)', () => {
  let service: AuthService;

  type MockUserRecord = {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: string;
    driverId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  const mockUsers: Record<string, MockUserRecord> = {};

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          return mockUsers[where.email.toLowerCase()] || null;
        }
        if (where.id) {
          return (
            Object.values(mockUsers).find((u) => u.id === where.id) || null
          );
        }
        return null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const user: MockUserRecord = {
          id: 'test-user-uuid-1',
          email: String(data.email),
          passwordHash: String(data.passwordHash),
          name: String(data.name),
          role: String(data.role),
          driverId: (data.driverId as string | null) || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUsers[user.email] = user;
        return user;
      }),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-jwt-access-secret-32-chars-long';
      if (key === 'JWT_REFRESH_SECRET')
        return 'test-jwt-refresh-secret-32-chars-long';
      return null;
    }),
  };

  beforeEach(async () => {
    for (const key in mockUsers) delete mockUsers[key];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('hashes password with Argon2id and generates JWT access and refresh tokens', async () => {
      const res = await service.register({
        email: 'test@fleetpulse.com',
        password: 'Password123!',
        name: 'Test Driver',
        role: UserRole.DRIVER,
      });

      expect(res.user.email).toBe('test@fleetpulse.com');
      expect(res.user.role).toBe(UserRole.DRIVER);
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.expiresIn).toBe(3600);

      // Verify Argon2 hash was stored
      const stored = mockUsers['test@fleetpulse.com'];
      expect(stored).toBeDefined();
      expect(stored!.passwordHash).not.toBe('Password123!');
      const isValid = await argon2.verify(stored!.passwordHash, 'Password123!');
      expect(isValid).toBe(true);

      // Verify token decoded claims
      const decoded = jwt.decode(res.accessToken) as jwt.JwtPayload & {
        email?: string;
        role?: string;
      };
      expect(decoded.email).toBe('test@fleetpulse.com');
      expect(decoded.role).toBe(UserRole.DRIVER);
    });

    it('rejects duplicate email with ConflictException', async () => {
      await service.register({
        email: 'duplicate@fleetpulse.com',
        password: 'Password123!',
        name: 'User One',
      });

      await expect(
        service.register({
          email: 'duplicate@fleetpulse.com',
          password: 'AnotherPassword456!',
          name: 'User Two',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({
        email: 'login@fleetpulse.com',
        password: 'CorrectPassword123!',
        name: 'Login User',
        role: UserRole.DISPATCHER,
      });
    });

    it('authenticates user with valid credentials and returns tokens', async () => {
      const res = await service.login({
        email: 'login@fleetpulse.com',
        password: 'CorrectPassword123!',
      });

      expect(res.user.email).toBe('login@fleetpulse.com');
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
    });

    it('rejects incorrect password with UnauthorizedException', async () => {
      await expect(
        service.login({
          email: 'login@fleetpulse.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects non-existent user with UnauthorizedException', async () => {
      await expect(
        service.login({
          email: 'unknown@fleetpulse.com',
          password: 'AnyPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('renews access token given a valid refresh token', async () => {
      const auth = await service.register({
        email: 'refresh@fleetpulse.com',
        password: 'Password123!',
        name: 'Refresh User',
      });

      const res = await service.refresh(auth.refreshToken);
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.user.email).toBe('refresh@fleetpulse.com');
    });

    it('rejects tampered or invalid refresh token with UnauthorizedException', async () => {
      await expect(service.refresh('invalid.jwt.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('returns user profile by ID without password hash', async () => {
      const auth = await service.register({
        email: 'me@fleetpulse.com',
        password: 'Password123!',
        name: 'Me User',
      });

      const profile = await service.getMe(auth.user.id);
      expect(profile.id).toBe(auth.user.id);
      expect(profile.email).toBe('me@fleetpulse.com');
      expect('passwordHash' in profile).toBe(false);
    });

    it('throws NotFoundException for non-existent user', async () => {
      await expect(service.getMe('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
