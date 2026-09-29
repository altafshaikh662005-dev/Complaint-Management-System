const express = require("express");
const {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  assignComplaint,
  updateComplaintStatus,
  resolveComplaint,
  deleteComplaint,
} = require("../controllers/complaintController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createComplaint);
router.get("/", protect, getComplaints);
router.get("/:id", protect, getComplaintById);
router.put("/:id", protect, updateComplaint);
router.put("/:id/assign", protect, assignComplaint);
router.put("/:id/status", protect, updateComplaintStatus);
router.put("/:id/resolve", protect, resolveComplaint);
router.delete("/:id", protect, deleteComplaint);

module.exports = router;
