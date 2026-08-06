import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable } from "rxjs";
import { resolveAppPublicUrl, runWithAppPublicUrl } from "./app-public-url.util";

/**
 * Captura a origem pública da app (header BFF, Origin, Referer) para links em email
 * gerados durante o mesmo pedido HTTP.
 */
@Injectable()
export class AppPublicUrlInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const appUrl = resolveAppPublicUrl(this.config, req);
    return new Observable((subscriber) => {
      runWithAppPublicUrl(appUrl, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err: unknown) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
