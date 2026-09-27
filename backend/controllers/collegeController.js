const supabase = require("../config/supabase");

const getColleges = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("colleges")
            .select("id, name")
            .order("name", { ascending: true });

        if (error) {
            console.error("Get colleges error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load colleges"
            });
        }

        res.json({
            success: true,
            colleges: data || []
        });

    } catch (error) {
        console.error("College controller error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    getColleges
};
