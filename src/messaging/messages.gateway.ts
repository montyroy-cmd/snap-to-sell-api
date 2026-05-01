import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time messaging namespace. Clients: io('/ws/messages', { path: '/socket.io', auth: { token } })
 */
@WebSocketGateway({
  namespace: '/ws/messages',
  cors: { origin: true, credentials: true },
})
export class MessagesGateway implements OnGatewayConnection {
  private readonly logger = new Logger(MessagesGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`WS connect without token: ${client.id}`);
    }
    const room =
      typeof client.handshake.auth?.profileId === 'string'
        ? client.handshake.auth.profileId
        : 'unauthenticated';
    void client.join(room);
  }

  /** Called from services when a new message is persisted (optional integration). */
  emitNewMessage(profileId: string, payload: unknown) {
    this.server.to(profileId).emit('message', payload);
  }
}
