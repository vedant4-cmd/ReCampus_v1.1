const supabase = require("../config/supabase");

const createNotification = async ({
    userId,
    title,
    message,
    type
}) => {
    try {
        const { error } = await supabase
            .from("notifications")
            .insert([
                {
                    user_id: userId,
                    title,
                    message,
                    type,
                    is_read: false
                }
            ]);

        if (error) {
            console.error(
                "Create notification error:",
                error
            );

            return false;
        }

        return true;

    } catch (error) {

        console.error(
            "Notification helper error:",
            error
        );

        return false;
    }
};

module.exports = {
    createNotification
};