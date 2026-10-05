const supabase = require("../config/supabase");


// =====================================================
// ADMIN DASHBOARD STATISTICS
// =====================================================

const getDashboardStats = async (req, res) => {
    try {

        const [
            usersResult,
            productsResult,
            ordersResult,
            paidOrdersResult
        ] = await Promise.all([

            supabase
                .from("users")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            supabase
                .from("products")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            supabase
                .from("orders")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            supabase
                .from("orders")
                .select("total_amount")
                .eq("payment_status", "paid")
        ]);


        if (
            usersResult.error ||
            productsResult.error ||
            ordersResult.error ||
            paidOrdersResult.error
        ) {
            return res.status(500).json({
                success: false,
                message:
                    "Failed to load dashboard statistics"
            });
        }


        const totalRevenue =
            (paidOrdersResult.data || []).reduce(
                (sum, order) =>
                    sum +
                    Number(order.total_amount || 0),
                0
            );


        res.json({
            success: true,

            stats: {
                totalUsers:
                    usersResult.count || 0,

                totalProducts:
                    productsResult.count || 0,

                totalOrders:
                    ordersResult.count || 0,

                totalRevenue
            }
        });

    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// =====================================================
// ADMIN COMMISSION DATA
// =====================================================

const getCommissionData = async (req, res) => {
    try {

        // -------------------------------------------------
        // Get all paid orders
        // -------------------------------------------------

        const {
            data: paidOrders,
            error: ordersError
        } = await supabase
            .from("orders")
            .select(
                "id, created_at, payment_status"
            )
            .eq("payment_status", "paid")
            .order("created_at", {
                ascending: false
            });


        if (ordersError) {

            console.error(
                "Commission orders error:",
                ordersError
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load commission orders"
            });
        }


        const paidOrderIds =
            (paidOrders || []).map(
                order => order.id
            );


        // No paid orders yet
        if (paidOrderIds.length === 0) {

            return res.json({
                success: true,

                commission: {
                    totalCommission: 0,
                    studentCommission: 0,
                    businessCommission: 0,
                    totalSales: 0,
                    totalCommissionSales: 0
                },

                history: []
            });
        }


        // -------------------------------------------------
        // Get commission records
        // -------------------------------------------------

        const {
            data: orderItems,
            error: itemsError
        } = await supabase
            .from("order_items")
            .select(`
                id,
                order_id,
                seller_id,
                product_id,
                price,
                quantity,
                commission_rate,
                commission_amount,
                created_at
            `)
            .in("order_id", paidOrderIds)
            .order("created_at", {
                ascending: false
            });


        if (itemsError) {

            console.error(
                "Commission items error:",
                itemsError
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load commission records"
            });
        }


        // -------------------------------------------------
        // Get sellers
        // -------------------------------------------------

        const sellerIds = [
            ...new Set(
                (orderItems || []).map(
                    item => item.seller_id
                )
            )
        ];


        let sellers = [];


        if (sellerIds.length > 0) {

            const {
                data,
                error: sellersError
            } = await supabase
                .from("users")
                .select(
                    "id, name, email, role"
                )
                .in("id", sellerIds);


            if (sellersError) {

                console.error(
                    "Commission sellers error:",
                    sellersError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load seller information"
                });
            }


            sellers = data || [];
        }


        // -------------------------------------------------
        // Create lookup maps
        // -------------------------------------------------

        const sellerMap = {};

        for (const seller of sellers) {
            sellerMap[seller.id] = seller;
        }


        const orderMap = {};

        for (const order of paidOrders || []) {
            orderMap[order.id] = order;
        }


        // -------------------------------------------------
        // Calculate commission totals
        // -------------------------------------------------

        let totalCommission = 0;
        let studentCommission = 0;
        let businessCommission = 0;
        let totalSales = 0;
        let totalCommissionSales = 0;


        const history =
            (orderItems || []).map(item => {

                const seller =
                    sellerMap[item.seller_id];

                const order =
                    orderMap[item.order_id];


                const saleAmount =
                    Number(item.price || 0) *
                    Number(item.quantity || 0);


                const commissionAmount =
                    Number(
                        item.commission_amount || 0
                    );


                totalSales += saleAmount;

                totalCommission +=
                    commissionAmount;


                if (
                    seller &&
                    seller.role ===
                        "student_seller"
                ) {
                    studentCommission +=
                        commissionAmount;
                }


                if (
                    seller &&
                    seller.role ===
                        "business_seller"
                ) {
                    businessCommission +=
                        commissionAmount;
                }


                if (commissionAmount > 0) {
                    totalCommissionSales++;
                }


                return {

                    orderItemId:
                        item.id,

                    orderId:
                        item.order_id,

                    sellerId:
                        item.seller_id,

                    sellerName:
                        seller?.name || "Unknown Seller",

                    sellerEmail:
                        seller?.email || "",

                    sellerType:
                        seller?.role || "unknown",

                    productId:
                        item.product_id,

                    price:
                        Number(item.price || 0),

                    quantity:
                        Number(item.quantity || 0),

                    saleAmount,

                    commissionRate:
                        Number(
                            item.commission_rate || 0
                        ),

                    commissionAmount,

                    orderDate:
                        order?.created_at || null
                };
            });


        // -------------------------------------------------
        // Return admin-only commission information
        // -------------------------------------------------

        res.json({

            success: true,

            commission: {

                totalCommission:
                    Number(
                        totalCommission.toFixed(2)
                    ),

                studentCommission:
                    Number(
                        studentCommission.toFixed(2)
                    ),

                businessCommission:
                    Number(
                        businessCommission.toFixed(2)
                    ),

                totalSales:
                    Number(
                        totalSales.toFixed(2)
                    ),

                totalCommissionSales
            },

            history

        });

    } catch (error) {

        console.error(
            "Admin commission error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load commission data"
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getDashboardStats,
    getCommissionData
};