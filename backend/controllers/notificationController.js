const supabase = require("../config/supabase");

// GET MY NOTIFICATIONS
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", {
                ascending: false
            })
            .limit(50);

        if (error) {
            console.error("Get notifications error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load notifications"
            });
        }

        res.json({
            success: true,
            notifications: data || []
        });

    } catch (error) {
        console.error("Notification error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET UNREAD COUNT
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { count, error } = await supabase
            .from("notifications")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("user_id", userId)
            .eq("is_read", false);

        if (error) {
            console.error("Unread notification error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to get unread count"
            });
        }

        res.json({
            success: true,
            count: count || 0
        });

    } catch (error) {
        console.error("Unread count error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// MARK ONE NOTIFICATION AS READ
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;
        const notificationId = req.params.id;

        const { data, error } = await supabase
            .from("notifications")
            .update({
                is_read: true
            })
            .eq("id", notificationId)
            .eq("user_id", userId)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read",
            notification: data
        });

    } catch (error) {
        console.error("Mark notification error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// MARK ALL NOTIFICATIONS AS READ
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { error } = await supabase
            .from("notifications")
            .update({
                is_read: true
            })
            .eq("user_id", userId)
            .eq("is_read", false);

        if (error) {
            console.error("Mark all notifications error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to mark notifications as read"
            });
        }

        res.json({
            success: true,
            message: "All notifications marked as read"
        });

    } catch (error) {
        console.error("Mark all notifications error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
};
