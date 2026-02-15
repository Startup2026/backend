// backend/tests/app.test.js
const request = require('supertest');
const { app, io, server } = require('../index');
const mongoose = require('mongoose');

describe('API Routing & Integration', () => {

  afterAll(async () => {
    // Close the server and io connection if they are running
    if (server) server.close();
    if (io) io.close();
  });

  test('GET /api/health-check - Route Mounting (404 expected if not defined, but checking prefix)', async () => {
    // Just testing that the app instance itself responds
    const res = await request(app).get('/api/invalid-route');
    expect(res.statusCode).not.toBe(500); // Should handle gracefully
  });

  test('Socket.io Initialization', () => {
    expect(io).toBeDefined();
    expect(io.engine).toBeDefined();
  });

  test('CORS Headers', async () => {
    const res = await request(app)
      .options('/api/some-route')
      .set('Origin', 'http://localhost:5173');
    
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
