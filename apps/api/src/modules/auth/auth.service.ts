import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { UserRole as PrismaUserRole } from '@prisma/client';
import {
  AuthResponse,
  JwtPayload,
  User,
  UserRole,
} from '@fleet-pulse/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'fleetpulse-dev-jwt-access-secret-minimum-32-chars-long';
    this.jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'fleetpulse-dev-jwt-refresh-secret-minimum-32-chars-long';
  }

  /**
   * Registers a new user with Argon2id password hashing
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(
        `A user with email "${dto.email}" is already registered.`,
      );
    }

    // Hash password with Argon2id algorithm
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const role = (dto.role as UserRole) || UserRole.DRIVER;

    // Create user in database
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: role as unknown as PrismaUserRole,
        driverId: dto.driverId || null,
      },
    });

    const safeUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      driverId: user.driverId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    const tokens = this.generateTokens(safeUser);

    return {
      ...tokens,
      user: safeUser,
    };
  }

  /**
   * Authenticates user via Argon2id verification and issues JWT pair
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValidPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const safeUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      driverId: user.driverId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    const tokens = this.generateTokens(safeUser);

    return {
      ...tokens,
      user: safeUser,
    };
  }

  /**
   * Refreshes access token using a valid refresh token
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        this.jwtRefreshSecret,
      ) as jwt.JwtPayload;

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub as string },
      });

      if (!user) {
        throw new UnauthorizedException('User no longer exists.');
      }

      const safeUser: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        driverId: user.driverId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };

      const tokens = this.generateTokens(safeUser);

      return {
        ...tokens,
        user: safeUser,
      };
    } catch (err) {
      throw new UnauthorizedException(
        `Invalid or expired refresh token: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Returns current user profile
   */
  async getMe(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      driverId: user.driverId,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to sign access (1h) and refresh (7d) JWT tokens
   */
  private generateTokens(user: User): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      driverId: user.driverId || null,
    };

    const expiresIn = 3600; // 1 hour

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: '1h',
    });

    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtRefreshSecret,
      {
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}
