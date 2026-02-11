import { NextResponse } from 'next/server';

export async function GET() {
  const doc = {
    openapi: '3.0.0',
    info: { title: 'GooverChat API', version: '1.0.0' },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', description: 'API' }],
    paths: {
      '/api/health': {
        get: {
          summary: 'Health check',
          responses: { 200: { description: 'Healthy' }, 503: { description: 'Degraded' } },
        },
      },
      '/api/auth/register': {
        post: {
          summary: 'Register',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'username', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    username: { type: 'string', pattern: '^[a-zA-Z0-9_]+$' },
                    password: { type: 'string', minLength: 8 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Created' }, 400: { description: 'Validation failed' }, 409: { description: 'Email/username taken' } },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Login',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: { email: { type: 'string' }, password: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'OK' }, 401: { description: 'Invalid credentials' } },
        },
      },
      '/api/auth/refresh': { post: { summary: 'Refresh access token', responses: { 200: { description: 'OK' }, 401: { description: 'Invalid refresh token' } } } },
      '/api/auth/logout': { post: { summary: 'Logout', responses: { 200: { description: 'OK' } } } },
      '/api/conversations': {
        get: { summary: 'List conversations', responses: { 200: { description: 'OK' } }, security: [{ cookieAuth: [] }] },
        post: {
          summary: 'Create conversation',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { type: { enum: ['direct', 'group'] }, memberIds: { type: 'array', items: { type: 'string' } }, name: { type: 'string' }, description: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'Created' } },
          security: [{ cookieAuth: [] }],
        },
      },
      '/api/conversations/{id}/messages': {
        get: { summary: 'List messages', parameters: [{ name: 'cursor', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } }, security: [{ cookieAuth: [] }] },
        post: {
          summary: 'Send message',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { text: { type: 'string' }, type: { enum: ['text', 'image', 'file', 'system'] }, replyToId: { type: 'string' }, forwardedFromId: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'Created' } },
          security: [{ cookieAuth: [] }],
        },
      },
    },
    components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' } } },
  };
  return NextResponse.json(doc);
}
