const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const User = require("../src/models/User");
const initializeAdmin = require("../src/config/initializeAdmin");

beforeAll(async () => {
  await mongoose.connect(
    process.env.MONGO_URI ||
      "mongodb://localhost:27017/complaint-management-system-test",
  );
  await mongoose.connection.db.dropDatabase().catch(() => {});
}, 20000);

afterAll(async () => {
  await mongoose.connection.close();
}, 20000);

describe("Authentication API", () => {
  const userData = {
    name: "Test User",
    email: "test@example.com",
    password: "Password123!",
  };

  test("successful registration", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty("token");
    expect(response.body.user.email).toBe(userData.email);
    expect(response.body.user.password).toBeUndefined();
  });

  test("duplicate email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(userData)
      .expect(400);

    expect(response.body.message).toMatch(/already exists|already registered/i);
  });

  test("successful login", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty("token");
    expect(response.body.user.email).toBe(userData.email);
  });

  test("invalid login", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: userData.email,
        password: "WrongPassword123!",
      })
      .expect(401);

    expect(response.body.message).toMatch(/invalid|incorrect/i);
  });

  test("protected endpoint without token", async () => {
    const response = await request(app).get("/api/auth/me").expect(401);

    expect(response.body.message).toMatch(/token|authorized|login/i);
  });

  test("protected endpoint with valid token", async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(response.body.email).toBe(userData.email);
    expect(response.body.password).toBeUndefined();
  });
});

describe("Admin initialization and authorization", () => {
  const adminConfig = {
    ADMIN_EMAIL: "configured-admin@example.com",
    ADMIN_PASSWORD: crypto.randomBytes(24).toString("base64url"),
    ADMIN_NAME: "Configured Administrator",
    ADMIN_PHONE: "+1-555-0100",
  };

  let admin;

  beforeAll(async () => {
    admin = await initializeAdmin(adminConfig);
  });

  test("creates an ADMIN account with bcrypt-hashed password and configured profile", async () => {
    expect(admin.role).toBe("ADMIN");
    expect(admin.email).toBe(adminConfig.ADMIN_EMAIL);
    expect(admin.name).toBe(adminConfig.ADMIN_NAME);
    expect(admin.phone).toBe(adminConfig.ADMIN_PHONE);
    expect(admin.password).not.toBe(adminConfig.ADMIN_PASSWORD);
    await expect(admin.matchPassword(adminConfig.ADMIN_PASSWORD)).resolves.toBe(
      true,
    );
  });

  test("does not create a duplicate when initialized again", async () => {
    const initializedAgain = await initializeAdmin(adminConfig);
    const adminCount = await User.countDocuments({
      email: adminConfig.ADMIN_EMAIL,
    });

    expect(initializedAgain._id.toString()).toBe(admin._id.toString());
    expect(adminCount).toBe(1);
  });

  test("promotes an existing USER and syncs configured credentials and profile", async () => {
    const promotedConfig = {
      ...adminConfig,
      ADMIN_EMAIL: "promoted-admin@example.com",
      ADMIN_PASSWORD: crypto.randomBytes(24).toString("base64url"),
      ADMIN_NAME: "Promoted Administrator",
      ADMIN_PHONE: "+1-555-0199",
    };
    const existingUser = await User.create({
      name: "Old User Name",
      email: promotedConfig.ADMIN_EMAIL,
      phone: "old-phone",
      password: "OldUserPassword123!",
      role: "USER",
    });

    const promotedUser = await initializeAdmin(promotedConfig);
    const accountCount = await User.countDocuments({
      email: promotedConfig.ADMIN_EMAIL,
    });

    expect(promotedUser._id.toString()).toBe(existingUser._id.toString());
    expect(promotedUser.role).toBe("ADMIN");
    expect(promotedUser.name).toBe(promotedConfig.ADMIN_NAME);
    expect(promotedUser.phone).toBe(promotedConfig.ADMIN_PHONE);
    expect(promotedUser.password).not.toBe(promotedConfig.ADMIN_PASSWORD);
    await expect(
      promotedUser.matchPassword(promotedConfig.ADMIN_PASSWORD),
    ).resolves.toBe(true);
    await expect(
      promotedUser.matchPassword("OldUserPassword123!"),
    ).resolves.toBe(false);
    expect(accountCount).toBe(1);
  });

  test("admin can log in with an ADMIN JWT and access admin authorization", async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: adminConfig.ADMIN_EMAIL,
        password: adminConfig.ADMIN_PASSWORD,
      })
      .expect(200);

    expect(loginResponse.body.user.role).toBe("ADMIN");
    expect(loginResponse.body.user.phone).toBe(adminConfig.ADMIN_PHONE);
    expect(
      jwt.verify(loginResponse.body.token, process.env.JWT_SECRET),
    ).toMatchObject({
      id: admin._id.toString(),
      role: "ADMIN",
    });

    const adminResponse = await request(app)
      .get("/api/auth/admin")
      .set("Authorization", `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(adminResponse.body.admin).toBe(adminConfig.ADMIN_EMAIL);

    const complaintResponse = await request(app)
      .get("/api/complaints")
      .set("Authorization", `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(Array.isArray(complaintResponse.body)).toBe(true);
  });

  test("normal USER cannot access admin-only endpoints", async () => {
    const registration = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Regular User",
        email: "regular-user-admin-check@example.com",
        password: "UserPassword123!",
      })
      .expect(201);

    expect(registration.body.user.role).toBe("USER");

    const response = await request(app)
      .get("/api/auth/admin")
      .set("Authorization", `Bearer ${registration.body.token}`)
      .expect(403);

    expect(response.body.message).toMatch(/admin access required/i);
  });
});

describe("Complaint API", () => {
  let userToken;
  let adminToken;
  let otherUserToken;
  let complaintId;
  let otherUserId;

  beforeAll(async () => {
    const userResponse = await request(app).post("/api/auth/register").send({
      name: "Complaint User",
      email: "complaint-user@example.com",
      password: "Password123!",
    });
    userToken = userResponse.body.token;

    const otherUserResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Other User",
        email: "other-user@example.com",
        password: "Password123!",
      });
    otherUserToken = otherUserResponse.body.token;
    otherUserId = otherUserResponse.body.user._id;

    const adminResponse = await request(app).post("/api/auth/register").send({
      name: "Admin User",
      email: "admin-user@example.com",
      password: "Password123!",
    });

    const User = require("../src/models/User");
    await User.findOneAndUpdate(
      { email: "admin-user@example.com" },
      { role: "ADMIN" },
      { new: true },
    );

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin-user@example.com",
      password: "Password123!",
    });
    adminToken = adminLogin.body.token;
  });

  test("authenticated user creates complaint", async () => {
    const response = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        title: "Printer not working",
        description: "The office printer is not responding to jobs.",
        category: "IT",
        priority: "HIGH",
      })
      .expect(201);

    complaintId = response.body._id;
    expect(response.body.status).toBe("SUBMITTED");
    expect(response.body.submittedBy).toBeTruthy();
  });

  test("unauthenticated user cannot create complaint", async () => {
    const response = await request(app)
      .post("/api/complaints")
      .send({
        title: "Unauthorized complaint",
        description: "This should fail without a token.",
        category: "IT",
        priority: "MEDIUM",
      })
      .expect(401);

    expect(response.body.message).toMatch(/token|authorized|login/i);
  });

  test("user can retrieve their own complaints", async () => {
    const response = await request(app)
      .get("/api/complaints")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.some((item) => item._id === complaintId)).toBe(true);
  });

  test("user cannot retrieve another user's complaint", async () => {
    const response = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .expect(403);

    expect(response.body.message).toMatch(
      /not authorized|own complaint|access/i,
    );
  });

  test("admin can retrieve all complaints", async () => {
    const response = await request(app)
      .get("/api/complaints")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test("only admins can retrieve safe user records", async () => {
    await request(app).get("/api/users").expect(401);

    await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: otherUserId,
          name: "Other User",
          email: "other-user@example.com",
          role: "USER",
        }),
      ]),
    );
    expect(
      response.body.every(
        (listedUser) =>
          JSON.stringify(Object.keys(listedUser).sort()) ===
          JSON.stringify(["_id", "email", "name", "role"]),
      ),
    ).toBe(true);
  });

  test("admin can assign a complaint", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ assignedTo: otherUserId })
      .expect(200);

    expect(response.body.status).toBe("ASSIGNED");
    expect(response.body.assignedTo).toBe(otherUserId);
  });

  test("admin can update complaint status", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "IN_PROGRESS" })
      .expect(200);

    expect(response.body.status).toBe("IN_PROGRESS");
  });

  test("reassignment preserves the IN_PROGRESS status", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ assignedTo: otherUserId })
      .expect(200);

    expect(response.body.status).toBe("IN_PROGRESS");
    expect(response.body.assignedTo).toBe(otherUserId);
  });

  test("invalid status transition is rejected", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SUBMITTED" })
      .expect(400);

    expect(response.body.message).toMatch(/invalid|not allowed|transition/i);
  });

  test("admin can resolve complaint", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ resolutionComment: "Issue fixed and verified." })
      .expect(200);

    expect(response.body.status).toBe("RESOLVED");
    expect(response.body.resolutionComment).toBe("Issue fixed and verified.");
  });

  test("resolved complaints cannot be reassigned", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ assignedTo: otherUserId })
      .expect(400);

    expect(response.body.message).toMatch(/resolved|reassigned/i);
    const complaint = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(complaint.body.status).toBe("RESOLVED");
  });

  test("unauthorized user cannot perform admin operation", async () => {
    const response = await request(app)
      .put(`/api/complaints/${complaintId}/assign`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ assignedTo: otherUserId })
      .expect(403);

    expect(response.body.message).toMatch(
      /admin|access required|not authorized/i,
    );
  });

  test("complaint validation errors", async () => {
    const response = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        description: "Missing title",
        category: "IT",
        priority: "LOW",
      })
      .expect(400);

    expect(response.body.message).toMatch(/title|required/i);
  });

  test("admin can delete complaint", async () => {
    const response = await request(app)
      .delete(`/api/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.message).toMatch(/deleted|removed/i);
  });
});
