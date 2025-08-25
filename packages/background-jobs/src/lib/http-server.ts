import type { Server } from "bun";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface Route {
  path: string;
  method: HttpMethod;
  handler: (request: Request) => Promise<Response> | Response;
}

export interface ServerOptions {
  port?: number;
  hostname?: string;
}

export class SimpleHttpServer {
  private server?: Server;
  private routes: Map<string, Route> = new Map();
  private port: number;
  private hostname: string;

  constructor(options: ServerOptions = {}) {
    this.port = options.port || 3000;
    this.hostname = options.hostname || "localhost";
  }

  addRoute(route: Route) {
    const key = `${route.method}:${route.path}`;
    this.routes.set(key, route);
  }

  get(path: string, handler: Route["handler"]) {
    this.addRoute({ path, method: "GET", handler });
  }

  post(path: string, handler: Route["handler"]) {
    this.addRoute({ path, method: "POST", handler });
  }

  put(path: string, handler: Route["handler"]) {
    this.addRoute({ path, method: "PUT", handler });
  }

  delete(path: string, handler: Route["handler"]) {
    this.addRoute({ path, method: "DELETE", handler });
  }

  patch(path: string, handler: Route["handler"]) {
    this.addRoute({ path, method: "PATCH", handler });
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method as HttpMethod;
    const key = `${method}:${url.pathname}`;

    const route = this.routes.get(key);
    if (route) {
      try {
        return await route.handler(request);
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = Bun.serve({
        port: this.port,
        hostname: this.hostname,
        fetch: (request) => this.handleRequest(request),
      });
      resolve();
    });
  }

  stop() {
    if (this.server) {
      this.server.stop();
      this.server = undefined;
    }
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return !!this.server;
  }
}
