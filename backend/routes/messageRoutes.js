const express = require("express");

const {
    sendMessage,
    getConversation,
    getConversations
} = require("../controllers/messageController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// Get all conversations
router.get(
    "/",
    authMiddleware,
    getConversations
);


// Get conversation with a specific user
router.get(
    "/:userId",
    authMiddleware,
    getConversation
);


// Send a message
router.post(
    "/",
    authMiddleware,
    sendMessage
);


module.exports = router;