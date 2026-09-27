const supabase = require("../config/supabase");


// Ask a question
const createQuestion = async (req, res) => {
    try {
        const { product_id, question } = req.body;

        if (!product_id || !question || !question.trim()) {
            return res.status(400).json({
                success: false,
                message: "Product ID and question are required"
            });
        }

        // Check product exists
        const { data: product, error: productError } = await supabase
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

        const { data, error } = await supabase
            .from("product_questions")
            .insert({
                product_id,
                user_id: req.user.userId,
                question: question.trim()
            })
            .select(`
                id,
                product_id,
                user_id,
                question,
                answer,
                created_at,
                answered_at
            `)
            .single();

        if (error) {
            console.error("Create question error:", error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Question posted successfully",
            question: data
        });

    } catch (error) {
        console.error("Create question error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// Get questions for a product
const getProductQuestions = async (req, res) => {
    try {
        const { productId } = req.params;

        const { data, error } = await supabase
            .from("product_questions")
            .select(`
                id,
                product_id,
                user_id,
                question,
                answer,
                created_at,
                answered_at,
                users!product_questions_user_id_fkey (
                    id,
                    name
                )
            `)
            .eq("product_id", productId)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error("Get questions error:", error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            questions: data || []
        });

    } catch (error) {
        console.error("Get questions error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// Answer a question
const answerQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { answer } = req.body;

        if (!answer || !answer.trim()) {
            return res.status(400).json({
                success: false,
                message: "Answer is required"
            });
        }

        // Get question + product seller
        const { data: question, error: questionError } = await supabase
            .from("product_questions")
            .select(`
                id,
                product_id,
                products (
                    seller_id
                )
            `)
            .eq("id", questionId)
            .single();

        if (questionError || !question) {
            return res.status(404).json({
                success: false,
                message: "Question not found"
            });
        }

        // Only the product seller can answer
        if (
            !question.products ||
            question.products.seller_id !== req.user.userId
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the product seller can answer this question"
            });
        }

        const { data, error } = await supabase
            .from("product_questions")
            .update({
                answer: answer.trim(),
                answered_by: req.user.userId,
                answered_at: new Date().toISOString()
            })
            .eq("id", questionId)
            .select(`
                id,
                product_id,
                user_id,
                question,
                answer,
                created_at,
                answered_at
            `)
            .single();

        if (error) {
            console.error("Answer question error:", error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: "Answer posted successfully",
            question: data
        });

    } catch (error) {
        console.error("Answer question error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    createQuestion,
    getProductQuestions,
    answerQuestion
};