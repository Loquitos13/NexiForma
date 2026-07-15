import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Rotas sem JWT (webhooks, login, health, API key própria, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
