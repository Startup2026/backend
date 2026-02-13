const Notification = require("../../../models/notification.model");

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // Handle both id (from token) and _id
    // console.log("Fetching notifications for user:", userId);
    
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 });

    // console.log(`Found ${notifications.length} notifications`);
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error fetching notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id || req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        await Notification.updateMany({ recipient: userId, read: false }, { read: true });
        res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all as read:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const count = await Notification.countDocuments({ recipient: userId, read: false });
        res.status(200).json({ success: true, count });
    } catch (error) {
        console.error("Error fetching unread count:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
