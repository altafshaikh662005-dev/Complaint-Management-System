const Complaint = require("../models/Complaint");
const User = require("../models/User");

const allowedStatusTransitions = {
  SUBMITTED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
};

const validateComplaintBody = ({ title, description, category, priority }) => {
  if (!title || !title.trim()) {
    return "Title is required";
  }

  if (!description || !description.trim()) {
    return "Description is required";
  }

  if (!category || !category.trim()) {
    return "Category is required";
  }

  if (!priority || !["LOW", "MEDIUM", "HIGH"].includes(priority)) {
    return "Priority must be LOW, MEDIUM, or HIGH";
  }

  return null;
};

const getComplaintAccessError = (user, complaint) => {
  if (user.role === "ADMIN") {
    return null;
  }

  if (complaint.submittedBy.toString() !== user._id.toString()) {
    return "You are not authorized to access this complaint";
  }

  return null;
};

const createComplaint = async (req, res) => {
  try {
    const validationMessage = validateComplaintBody(req.body);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const complaint = await Complaint.create({
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      category: req.body.category.trim(),
      priority: req.body.priority,
      submittedBy: req.user._id,
      status: "SUBMITTED",
    });

    return res.status(201).json(complaint);
  } catch (error) {
    console.error("Create complaint error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while creating complaint" });
  }
};

const getComplaints = async (req, res) => {
  try {
    let complaints;

    if (req.user.role === "ADMIN") {
      complaints = await Complaint.find()
        .populate("submittedBy", "name email role")
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });
    } else {
      complaints = await Complaint.find({ submittedBy: req.user._id })
        .populate("submittedBy", "name email role")
        .populate("assignedTo", "name email role")
        .sort({ createdAt: -1 });
    }

    return res.status(200).json(complaints);
  } catch (error) {
    console.error("Get complaints error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching complaints" });
  }
};

const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("submittedBy", "name email role")
      .populate("assignedTo", "name email role");

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (req.user.role !== "ADMIN") {
      if (complaint.submittedBy._id.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "You are not authorized to view this complaint" });
      }
    }

    return res.status(200).json(complaint);
  } catch (error) {
    console.error("Get complaint error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching complaint" });
  }
};

const updateComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (
      req.user.role !== "ADMIN" &&
      complaint.submittedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this complaint" });
    }

    const allowedFields = ["title", "description", "category", "priority"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        complaint[field] = req.body[field];
      }
    });

    if (req.body.title !== undefined && !complaint.title.trim()) {
      return res.status(400).json({ message: "Title cannot be empty" });
    }

    if (req.body.description !== undefined && !complaint.description.trim()) {
      return res.status(400).json({ message: "Description cannot be empty" });
    }

    if (req.body.category !== undefined && !complaint.category.trim()) {
      return res.status(400).json({ message: "Category cannot be empty" });
    }

    if (
      req.body.priority !== undefined &&
      !["LOW", "MEDIUM", "HIGH"].includes(complaint.priority)
    ) {
      return res
        .status(400)
        .json({ message: "Priority must be LOW, MEDIUM, or HIGH" });
    }

    await complaint.save();
    return res.status(200).json(complaint);
  } catch (error) {
    console.error("Update complaint error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while updating complaint" });
  }
};

const assignComplaint = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (complaint.status === "RESOLVED") {
      return res
        .status(400)
        .json({ message: "Resolved complaints cannot be reassigned" });
    }

    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ message: "assignedTo is required" });
    }

    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res.status(404).json({ message: "Assigned user not found" });
    }

    complaint.assignedTo = assignedTo;
    if (complaint.status === "SUBMITTED") {
      complaint.status = "ASSIGNED";
    }
    await complaint.save();

    return res.status(200).json(complaint);
  } catch (error) {
    console.error("Assign complaint error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while assigning complaint" });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const { status } = req.body;
    const validTransitions = allowedStatusTransitions[complaint.status] || [];

    if (
      !status ||
      !["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"].includes(status)
    ) {
      return res.status(400).json({
        message:
          "Status must be one of SUBMITTED, ASSIGNED, IN_PROGRESS, RESOLVED",
      });
    }

    if (!validTransitions.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${complaint.status} to ${status}`,
      });
    }

    complaint.status = status;
    await complaint.save();
    return res.status(200).json(complaint);
  } catch (error) {
    console.error("Update status error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while updating complaint status" });
  }
};

const resolveComplaint = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (complaint.status !== "IN_PROGRESS") {
      return res.status(400).json({
        message: "Complaint must be IN_PROGRESS before resolution",
      });
    }

    const { resolutionComment } = req.body;
    if (!resolutionComment || !resolutionComment.trim()) {
      return res
        .status(400)
        .json({ message: "Resolution comment is required" });
    }

    complaint.status = "RESOLVED";
    complaint.resolutionComment = resolutionComment.trim();
    await complaint.save();

    return res.status(200).json(complaint);
  } catch (error) {
    console.error("Resolve complaint error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while resolving complaint" });
  }
};

const deleteComplaint = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    await complaint.deleteOne();
    return res.status(200).json({ message: "Complaint deleted successfully" });
  } catch (error) {
    console.error("Delete complaint error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while deleting complaint" });
  }
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  assignComplaint,
  updateComplaintStatus,
  resolveComplaint,
  deleteComplaint,
};
