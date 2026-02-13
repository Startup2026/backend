const express = require("express");
const router = express.Router();
const notificationController = require("../controller/common/notificationController/notification.controller");
const token_middleware = require("../middleware/jwttoken.middleware");

router.get("/notifications", token_middleware, notificationController.getNotifications);
router.get("/notifications/unread-count", token_middleware, notificationController.getUnreadCount);
router.put("/notifications/:notificationId/read", token_middleware, notificationController.markAsRead);
router.put("/notifications/read-all", token_middleware, notificationController.markAllAsRead);

module.exports = router;
