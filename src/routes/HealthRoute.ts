import { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function registerHealthRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  fastify.get(
    "/health",
    {
      schema: {
        description: "Health check endpoint",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
      };
    }
  );
}
