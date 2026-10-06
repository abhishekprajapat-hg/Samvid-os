const express = require("express");
const router = express.Router();
const taskController = require("../controllers/task.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { requirePageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");
const Task = require("../models/Task");
const { requireAdminApprovalForDelete, describeByModel } = require("../services/deleteApproval.service");

// All routes are protected by JWT authentication
router.use(authMiddleware.protect);

// Task creation and the active-user picker are available to every signed-in
// company member, irrespective of organisational role.
router.get("/assignees", taskController.getAssignees);
router.post("/", writeLimiter, taskController.createTask);

router.use(requirePageAccess("tasks"));
router.use(requirePageActionForMethod("tasks"));

router.get("/", taskController.getTasks);
router.get("/stats", taskController.getTaskStats);
router.get("/stats/by-user", taskController.getTaskStatsByUser);
router.get("/:taskId", taskController.getTaskById);

router.patch("/:taskId", writeLimiter, taskController.updateTask);
router.post("/:taskId/subtasks", writeLimiter, taskController.addSubtask);
router.patch("/:taskId/subtasks/:subtaskId", writeLimiter, taskController.updateSubtask);
router.delete("/:taskId/subtasks/:subtaskId", writeLimiter, taskController.deleteSubtask);
// A Manager's delete becomes a request an Admin approves.
router.delete(
  "/:taskId",
  writeLimiter,
  requireAdminApprovalForDelete("task", {
    label: "Task",
    pageKey: "tasks",
    idParam: "taskId",
    handler: taskController.deleteTask,
    describe: describeByModel(Task, ["title"]),
  }),
  taskController.deleteTask,
);

module.exports = router;
