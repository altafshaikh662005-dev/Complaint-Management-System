const User = require("../models/User");

const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email role")
      .sort({ name: 1, email: 1 })
      .lean();

    return res.status(200).json(users);
  } catch (error) {
    console.error("Get users error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching users" });
  }
};

module.exports = { getUsers };
