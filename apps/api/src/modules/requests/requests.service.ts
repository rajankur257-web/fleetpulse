import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { DeliveryRequest, RequestStatus } from '@prisma/client';
import { DeliveryRequest as SharedDeliveryRequest } from '@fleet-pulse/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../realtime/events.gateway';
import { CreateRequestDto } from './dto/create-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway?: EventsGateway,
  ) {}

  async create(dto: CreateRequestDto): Promise<DeliveryRequest> {
    const request = await this.prisma.deliveryRequest.create({
      data: {
        pickupLat: Number(dto.pickupLat),
        pickupLng: Number(dto.pickupLng),
        dropLat: Number(dto.dropLat),
        dropLng: Number(dto.dropLng),
        priority: dto.priority || 1,
        status: RequestStatus.pending,
      },
    });

    // Write DispatchEvent audit ledger
    await this.prisma.dispatchEvent.create({
      data: {
        requestId: request.id,
        type: 'request:created',
        payload: {
          pickup: { lat: request.pickupLat, lng: request.pickupLng },
          drop: { lat: request.dropLat, lng: request.dropLng },
          priority: request.priority,
        },
      },
    });

    if (this.eventsGateway) {
      this.eventsGateway.broadcastRequestCreated({
        request: request as unknown as SharedDeliveryRequest,
      });
    }

    return request;
  }

  async findAll(query: QueryRequestsDto): Promise<{
    data: DeliveryRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = query.status ? { status: query.status } : {};

    const [data, total] = await Promise.all([
      this.prisma.deliveryRequest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedDriver: {
            select: { id: true, name: true, phone: true, rating: true },
          },
        },
      }),
      this.prisma.deliveryRequest.count({ where }),
    ]);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string): Promise<DeliveryRequest> {
    const request = await this.prisma.deliveryRequest.findUnique({
      where: { id },
      include: {
        assignedDriver: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Delivery request with ID "${id}" not found`);
    }

    return request;
  }

  async cancel(id: string): Promise<DeliveryRequest> {
    const request = await this.findOne(id);

    if (
      request.status === RequestStatus.delivered ||
      request.status === RequestStatus.cancelled ||
      request.status === RequestStatus.expired
    ) {
      throw new BadRequestException(
        `Cannot cancel request in terminal state "${request.status}"`,
      );
    }

    const updated = await this.prisma.deliveryRequest.update({
      where: { id },
      data: { status: RequestStatus.cancelled },
    });

    await this.prisma.dispatchEvent.create({
      data: {
        requestId: updated.id,
        driverId: updated.assignedDriverId,
        type: 'request:cancelled',
        payload: {
          previousStatus: request.status,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  }
}
