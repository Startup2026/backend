const Notification = require("../models/notification.model");
const { getIo } = require("../config/socket");

/**
 * Creates a notification in DB and emits it via Socket.io
 */
const createAndSendNotification = async (userId, title, message, type = 'info', relatedId = null) => {
    try {
        const notification = new Notification({
            recipient: userId,
            title,
            message,
            type,
            relatedId
        });

        await notification.save();

        try {
            const io = getIo();
            // Emit to the specific user's room
            io.to(userId.toString()).emit("new_notification", notification);
            console.log(`Notification emitted to user ${userId}`);
        } catch (socketErr) {
            console.warn("Socket.io not initialized or error emitting:", socketErr.message);
        }

        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        throw error;
    }
};

module.exports = { createAndSendNotification };
