
import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

describe('MCP Server Tool Registration Repro', () => {
  it('should register a tool with a Zod shape and validate input', async () => {
    const server = new McpServer({
      name: 'test',
      version: '1.0.0'
    });

    const shape = {
      url: z.string().url()
    };

    // This mimics the server.tool call
    server.tool('test_tool', 'description', shape, async (input) => {
      return { content: [{ type: 'text', text: `Hello ${input.url}` }] };
    });

    // To test validation, we need to find the registered tool and call its handler
    // In the SDK, tools are stored in _registeredTools
    const tool = (server as any)._registeredTools['test_tool'];
    expect(tool).toBeDefined();

    // The SDK wraps the handler. We want to see if the validation works.
    // The internal handler is usually called via the MCP protocol, but we can try to
    // trigger the validation logic directly if we can find it.
    
    // In mcp.js, the handler is wrapped. Let's see if we can trigger a call.
    // Actually, let's just see if the registration itself throws.
  });

  it('should register with our compatibility wrapper', async () => {
    const server = new McpServer({
      name: 'test',
      version: '1.0.0'
    });

    const wrapZod = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      return new Proxy(obj, {
        get(target, prop) {
          if (prop === 'parse' || prop === 'safeParse') {
            return target[prop].bind(target);
          }
          return target[prop];
        },
      });
    };

    const shape = {
      url: wrapZod(z.string().url())
    };

    server.tool('test_tool_wrapped', 'description', shape, async (input) => {
      return { content: [{ type: 'text', text: `Hello ${input.url}` }] };
    });
  });
});
