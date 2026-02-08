const Notification = require("../../../models/notification.model");

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id; // Assumes jwt middleware sets req.user
    
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error fetching notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        await Notification.updateMany({ recipient: userId, read: false }, { read: true });
        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all as read:", error);
        res.status(500).json({ message: "Server error" });
    }
}
