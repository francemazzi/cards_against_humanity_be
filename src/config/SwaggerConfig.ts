export function getSwaggerConfig() {
  return {
    openapi: {
      info: {
        title: "Cards Against Humanity API",
        description: "API documentation for Cards Against Humanity Backend",
        version: "1.0.0",
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3300}`,
          description: "Development server",
        },
      ],
      tags: [{ name: "health", description: "Health check endpoints" }],
    },
  };
}
