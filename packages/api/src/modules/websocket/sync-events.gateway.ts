import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws/sync-events',
})
export class SyncEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SyncEventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string
        || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      (client as any).userId = payload.sub;
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectGroupId: string },
  ) {
    const room = `project-group:${data.projectGroupId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'subscribed', data: { room } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectGroupId: string },
  ) {
    const room = `project-group:${data.projectGroupId}`;
    client.leave(room);
    return { event: 'unsubscribed', data: { room } };
  }

  // Methods called by services to emit events
  emitSyncStarted(projectGroupId: string, syncId: string) {
    this.server.to(`project-group:${projectGroupId}`).emit('sync:started', { syncId, projectGroupId });
  }

  emitSyncProgress(projectGroupId: string, syncId: string, variantId: string, progress: number) {
    this.server.to(`project-group:${projectGroupId}`).emit('sync:progress', { syncId, variantId, progress });
  }

  emitSyncCompleted(projectGroupId: string, syncId: string, results: any) {
    this.server.to(`project-group:${projectGroupId}`).emit('sync:completed', { syncId, results });
  }

  emitSyncFailed(projectGroupId: string, syncId: string, error: string) {
    this.server.to(`project-group:${projectGroupId}`).emit('sync:failed', { syncId, error });
  }

  emitReviewPending(projectGroupId: string, reviewId: string, variantId: string) {
    this.server.to(`project-group:${projectGroupId}`).emit('review:pending', { reviewId, variantId });
  }

  emitReviewApproved(projectGroupId: string, reviewId: string, approvedBy: string) {
    this.server.to(`project-group:${projectGroupId}`).emit('review:approved', { reviewId, approvedBy });
  }
}
