import type { Request, Response } from 'express';

export default function handler(_request: Request, response: Response) {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ status: 'ok', service: 'evaluation-api' }));
}
