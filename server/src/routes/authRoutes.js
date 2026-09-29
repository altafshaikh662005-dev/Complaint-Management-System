const express = require("express");
const {
  registerUser,
  loginUser,
  getMe,
  adminDashboard,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.get("/admin", protect, adminOnly, adminDashboard);

module.exports = router;
