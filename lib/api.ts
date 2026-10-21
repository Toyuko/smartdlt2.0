import { unstable_rethrow } from "next/navigation";
import { hashRateLimitKey } from "@/lib/booking/tokens";
import { clientIp, jsonError } from "@/lib/http";

export function route(handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> | Response) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(request, context);
    } catch (error) {
      unstable_rethrow(error);
      return jsonError(error);
    }
  };
}

export function rateKey(request: Request) {
  return hashRateLimitKey(clientIp(request));
}
