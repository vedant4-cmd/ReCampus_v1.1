const supabase = require("../config/supabase");
const {createNotification} = require("../utils/notification");

// SEND MESSAGE
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const {
            receiver_id,
            product_id,
            message
        } = req.body;

        if (!receiver_id || !message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Receiver and message are required"
            });
        }

        if (receiver_id === senderId) {
            return res.status(400).json({
                success: false,
                message: "You cannot message yourself"
            });
        }

        // Check receiver exists
        const { data: receiver, error: receiverError } =
            await supabase
                .from("users")
                .select("id")
                .eq("id", receiver_id)
                .single();

        if (receiverError || !receiver) {
            return res.status(404).json({
                success: false,
                message: "Receiver not found"
            });
        }

        // If product_id is provided, verify product exists
        if (product_id) {
            const { data: product, error: productError } =
                await supabase
                    .from("products")
                    .select("id")
                    .eq("id", product_id)
                    .single();

            if (productError || !product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }
        }

        const { data, error } = await supabase
            .from("messages")
            .insert([
                {
                    sender_id: senderId,
                    receiver_id,
                    product_id: product_id || null,
                    message: message.trim(),
                    is_read: false
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Send message error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to send message"
            });
        }

        await createNotification({
            userId: receiver_id,
            title: "New Message",
            message: "You received a new message.",
            type: "message"
        });

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data
        });

    } catch (error) {
        console.error("Send message error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET CONVERSATION
const getConversation = async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const otherUserId = req.params.userId;

        if (currentUserId === otherUserId) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation"
            });
        }

        const { data, error } = await supabase
            .from("messages")
            .select(`
                id,
                sender_id,
                receiver_id,
                product_id,
                message,
                is_read,
                created_at
            `)
            .or(
                `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
            )
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error("Get conversation error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load conversation"
            });
        }

        // Mark received messages as read
        await supabase
            .from("messages")
            .update({
                is_read: true
            })
            .eq("sender_id", otherUserId)
            .eq("receiver_id", currentUserId)
            .eq("is_read", false);

        res.json({
            success: true,
            messages: data || []
        });

    } catch (error) {
        console.error("Conversation error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET CONVERSATION LIST

const getConversations = async (req, res) => {
    try {
        const currentUserId = req.user.userId;

        const { data, error } = await supabase
            .from("messages")
            .select(`
                id,
                sender_id,
                receiver_id,
                product_id,
                message,
                is_read,
                created_at
            `)
            .or(
                `sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`
            )
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error("Get conversations error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load conversations"
            });
        }

        // Keep only the latest message per conversation
        const conversations = {};

        for (const msg of data || []) {

            const otherUserId =
                msg.sender_id === currentUserId
                    ? msg.receiver_id
                    : msg.sender_id;

            if (!conversations[otherUserId]) {
                conversations[otherUserId] = msg;
            }
        }

        const userIds = Object.keys(conversations);

        let users = [];

        if (userIds.length > 0) {
            const { data: userData, error: userError } =
                await supabase
                    .from("users")
                    .select("id, name, role")
                    .in("id", userIds);

            if (userError) {
                console.error("Get conversation users error:", userError);
            } else {
                users = userData || [];
            }
        }

        const conversationList =
            Object.entries(conversations).map(
                ([userId, msg]) => {

                    const otherUser = users.find(
                        user => user.id === userId
                    );

                    return {
                        user_id: userId,
                        user_name:
                            otherUser?.name || "User",
                        user_role:
                            otherUser?.role || "buyer",
                        last_message: msg.message,
                        product_id: msg.product_id,
                        is_read:
                            msg.sender_id === currentUserId
                                ? true
                                : msg.is_read,
                        created_at: msg.created_at
                    };
                }
            );

        res.json({
            success: true,
            conversations: conversationList
        });

    } catch (error) {
        console.error("Conversation list error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    sendMessage,
    getConversation,
    getConversations
};
