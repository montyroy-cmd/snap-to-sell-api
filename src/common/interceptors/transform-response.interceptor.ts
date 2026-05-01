import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_API_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message: string;
  error: null | { code: string; details?: unknown };
};

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiEnvelope<unknown> | unknown> {
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_API_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data: unknown) => {
        if (skipEnvelope) {
          return data;
        }
        return {
          success: true,
          data: data === undefined ? {} : data,
          message: '',
          error: null,
        };
      }),
    );
  }
}
