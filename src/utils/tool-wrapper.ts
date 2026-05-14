type McpToolResponse = { content: { type: "text"; text: string }[]; isError?: boolean };
type ToolHandler<T> = (args: T) => Promise<McpToolResponse>;

/**
 * Wraps a tool handler with error handling.
 * Catches any thrown error, logs it to stderr for debugging, and returns a
 * structured MCP error response instead of crashing the transport.
 */
export function withTool<T>(name: string, handler: ToolHandler<T>): ToolHandler<T> {
  return async (args: T): Promise<McpToolResponse> => {
    try {
      return await handler(args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[mural-mcp] ${name} error:`, e);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  };
}
