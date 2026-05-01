import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.mapToHttp(exception);
    const status = mapped.status;
    const message = mapped.message;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} ${status}: ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      data: null,
      message,
      error: {
        code: HttpStatus[status] ?? 'ERROR',
        details: mapped.details,
      },
    });
  }

  private mapToHttp(exception: unknown): {
    status: number;
    message: string;
    details?: object;
  } {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      return {
        status: exception.getStatus(),
        message: this.extractMessage(exception),
        details: typeof body === 'object' && body !== null ? body : undefined,
      };
    }

    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return {
          status: HttpStatus.PAYLOAD_TOO_LARGE,
          message: 'Photo file is too large. Maximum size is 10 MB.',
          details: { code: exception.code },
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Upload error: ${exception.message}`,
        details: { code: exception.code },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with this data already exists.',
          details: { prismaCode: exception.code },
        };
      }
      if (exception.code === 'P2003' || exception.code === 'P2025') {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid reference: related record was not found.',
          details: { prismaCode: exception.code },
        };
      }
      this.logger.debug(`Prisma error ${exception.code}: ${exception.message}`);
      return {
        status: HttpStatus.BAD_REQUEST,
        message:
          'Database could not process this request. Check your input and try again.',
        details: { prismaCode: exception.code },
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid data for database operation.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private extractMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && res !== null && 'message' in res) {
      const m = (res as { message: string | string[] }).message;
      return Array.isArray(m) ? m.join(', ') : String(m);
    }
    return exception.message;
  }
}
