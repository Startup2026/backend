// backend/tests/auth.test.js
const request = require('supertest');
const { app } = require('../index');
const mongoose = require('mongoose');

describe('Authentication Flow', () => {
  beforeAll(async () => {
    // Ideally connect to a test database or mock Mongoose
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  }, 30000); // Increase timeout to 30s for remote DB connection

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('POST /api/auth/login - Missing Credentials (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Email and password required');
  }, 10000);

  test('POST /api/auth/login - Invalid Credentials (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'invalid@example.com',
      password: 'wrongpassword'
    });
    expect(res.statusCode).toBe(401);
  }, 10000);

  // Note: For Unverified and Success, you'd typically need to seed a user or mock User.findOne
});
