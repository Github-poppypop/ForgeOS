import type { Express, Request, Response } from 'express';

export interface SSEHub {
  addClient(res: Response): void;
  removeClient(res: Response): void;
  broadcast(event: string, data: unknown): void;
  handler(req: Request, res: Response): void;
  register(app: Express, path?: string): void;
}

export function createSSEHub(): SSEHub {
  const clients = new Set<Response>();

  const addClient = (res: Response): void => {
    clients.add(res);
  };

  const removeClient = (res: Response): void => {
    clients.delete(res);
  };

  const broadcast = (event: string, data: unknown): void => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      if (!res.writableEnded) {
        res.write(payload);
      }
    }
  };

  const handler = (req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // keep-alive comment line
    res.write(':\n');
    addClient(res);
    req.on('close', () => removeClient(res));
    res.on('error', () => removeClient(res));
  };

  const register = (app: Express, path = '/api/stream'): void => {
    app.get(path, (req, res) => handler(req, res));
  };

  return { addClient, removeClient, broadcast, handler, register };
}
