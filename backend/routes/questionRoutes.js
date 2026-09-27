const express = require("express");

const {
    createQuestion,
    getProductQuestions,
    answerQuestion
} = require("../controllers/questionController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// Get questions for a product
router.get(
    "/product/:productId",
    getProductQuestions
);


// Ask a question
router.post(
    "/",
    authMiddleware,
    createQuestion
);


// Answer a question
router.put(
    "/:questionId",
    authMiddleware,
    answerQuestion
);


module.exports = router;