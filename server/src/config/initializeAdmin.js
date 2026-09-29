const User = require("../models/User");

const updateAdminAccount = async (
  user,
  { adminName, adminPhone, adminPassword },
) => {
  user.name = adminName;
  user.phone = adminPhone;
  user.role = "ADMIN";

  if (!(await user.matchPassword(adminPassword))) {
    user.password = adminPassword;
  }

  await user.save();
  return user;
};

const initializeAdmin = async (environment = process.env) => {
  const adminEmail = environment.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = environment.ADMIN_PASSWORD;
  const adminName = environment.ADMIN_NAME?.trim();
  const adminPhone = environment.ADMIN_PHONE?.trim();

  if (!adminEmail || !adminPassword || !adminName || !adminPhone) {
    throw new Error(
      "ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, and ADMIN_PHONE must be configured",
    );
  }

  if (adminPassword.length < 6) {
    throw new Error("ADMIN_PASSWORD must be at least 6 characters long");
  }

  const existingUser = await User.findOne({ email: adminEmail });
  if (existingUser) {
    return updateAdminAccount(existingUser, {
      adminName,
      adminPhone,
      adminPassword,
    });
  }

  try {
    return await User.create({
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      password: adminPassword,
      role: "ADMIN",
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const concurrentlyCreatedUser = await User.findOne({ email: adminEmail });
    if (concurrentlyCreatedUser) {
      return updateAdminAccount(concurrentlyCreatedUser, {
        adminName,
        adminPhone,
        adminPassword,
      });
    }
    throw error;
  }
};

module.exports = initializeAdmin;
