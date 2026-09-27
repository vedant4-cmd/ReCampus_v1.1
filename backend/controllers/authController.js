const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

// REGISTER
const register = async (req, res) => {
    try {
        const { name, email, password, college_id, role } = req.body;

        const allowedRoles = [
            "buyer",
            "student_seller",
            "business_seller"
        ];

        const selectedRole = role || "buyer";

        if (!allowedRoles.includes(selectedRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user role"
            });
        }

        // Basic validation
        if (!name || !email || !password || !college_id) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and college are required"
            });
        }

        // Check if email already exists
        const { data: existingUser, error: existingError } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (existingError) {
            return res.status(500).json({
                success: false,
                message: existingError.message
            });
        }

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Hash password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data: user, error } = await supabase
            .from("users")
            .insert([
                {
                    name,
                    email,
                    password_hash: hashedPassword,
                    college_id,
                    role: selectedRole,
                    seller_verification_status:
                        selectedRole === "student_seller" ||
                        selectedRole === "business_seller"
                            ? "pending"
                            : "not_required"
                }
            ])
            .select("id, name, email, college_id, role, created_at")
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Compare entered password with stored password hash
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        // Never send password hash to the frontend
        delete user.password_hash;

        res.json({
            success: true,
            message: "Login successful",
            token,
            user
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    register,
    login
};