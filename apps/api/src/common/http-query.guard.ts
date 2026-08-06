import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  MethodNotAllowedException,
} from "@nestjs/common";
import { HTTP_QUERY_METHOD } from "@nexiforma/shared";
import type { Request } from "express";

/** Exige QUERY (RFC 10008) ou POST com corpo JSON - Next.js não expõe QUERY no App Router. */
@Injectable()
export class HttpQueryMethodGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== HTTP_QUERY_METHOD && req.method !== "POST") {
      throw new MethodNotAllowedException(
        `Utilize ${HTTP_QUERY_METHOD} ou POST com corpo application/json (evita dados sensíveis na URL).`,
      );
    }
    const ct = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
    if (ct !== "application/json") {
      throw new BadRequestException("QUERY requer Content-Type: application/json.");
    }
    return true;
  }
}
