import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  MethodNotAllowedException,
} from "@nestjs/common";
import { HTTP_QUERY_METHOD } from "@nexiforma/shared";
import type { Request } from "express";

/** Exige método QUERY (RFC 10008) e Content-Type JSON. */
@Injectable()
export class HttpQueryMethodGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== HTTP_QUERY_METHOD) {
      throw new MethodNotAllowedException(
        `Utilize ${HTTP_QUERY_METHOD} com corpo application/json (evita dados sensíveis na URL).`,
      );
    }
    const ct = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
    if (ct !== "application/json") {
      throw new BadRequestException("QUERY requer Content-Type: application/json.");
    }
    return true;
  }
}
