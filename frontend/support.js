const API_URL = "http://localhost:5000/api";

const token = localStorage.getItem("recampus_token");


// Check login
if (!token) {
    alert("Please login to access customer support.");
    window.location.href = "login.html";
}


// Load buyer orders
async function loadOrders() {

    const orderSelect =
        document.getElementById("orderId");

    try {

        const response = await fetch(
            `${API_URL}/support/orders`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to load orders"
            );
        }


        if (
            !data.orders ||
            data.orders.length === 0
        ) {

            orderSelect.innerHTML = `
                <option value="">
                    No paid orders found
                </option>
            `;

            return;
        }


        orderSelect.innerHTML = `
            <option value="">
                Select an order
            </option>
        `;


        data.orders.forEach(order => {

            const date =
                new Date(
                    order.created_at
                ).toLocaleDateString();

            const option =
                document.createElement("option");

            option.value = order.id;

            option.textContent =
                `Order #${order.id} — ₹${order.total_amount} — ${date}`;

            orderSelect.appendChild(option);

        });


        // Store orders for product selection
        window.supportOrders = data.orders;


    } catch (error) {

        console.error(error);

        orderSelect.innerHTML = `
            <option value="">
                Failed to load orders
            </option>
        `;
    }
}


// When order changes, show its products
document
    .getElementById("orderId")
    .addEventListener("change", function () {

        const orderId = Number(this.value);

        const productSelect =
            document.getElementById("productId");


        productSelect.innerHTML = `
            <option value="">
                Select a product
            </option>
        `;


        productSelect.disabled = true;


        if (!orderId) {

            productSelect.innerHTML = `
                <option value="">
                    Select an order first
                </option>
            `;

            return;
        }


        const order =
            window.supportOrders.find(
                item => item.id === orderId
            );


        if (
            !order ||
            !order.order_items ||
            order.order_items.length === 0
        ) {

            productSelect.innerHTML = `
                <option value="">
                    No products found
                </option>
            `;

            return;
        }


        order.order_items.forEach(item => {

            const option =
                document.createElement("option");

            option.value = item.product_id;

            option.textContent =
                `${item.products?.title || "Product"} × ${item.quantity}`;

            productSelect.appendChild(option);

        });


        productSelect.disabled = false;

    });


// Submit request
document
    .getElementById("supportForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();


        const type =
            document.getElementById("requestType").value;

        const orderId =
            document.getElementById("orderId").value;

        const productId =
            document.getElementById("productId").value;

        const reason =
            document
                .getElementById("reason")
                .value
                .trim();

        const description =
            document
                .getElementById("description")
                .value
                .trim();

        const formMessage =
            document.getElementById("formMessage");


        if (!type || !reason || !description) {

            formMessage.innerHTML = `
                <div class="alert alert-warning">
                    Please fill all required fields.
                </div>
            `;

            return;
        }


        if (
            (type === "refund" ||
             type === "replacement") &&
            !orderId
        ) {

            formMessage.innerHTML = `
                <div class="alert alert-warning">
                    Please select an order for this request.
                </div>
            `;

            return;
        }


        try {

            const response = await fetch(
                `${API_URL}/support`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        order_id:
                            orderId
                                ? Number(orderId)
                                : null,

                        product_id:
                            productId
                                ? Number(productId)
                                : null,

                        type,

                        reason,

                        description

                    })
                }
            );


            const data = await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to submit request"
                );
            }


            formMessage.innerHTML = `
                <div class="alert alert-success">
                    ${data.message}
                </div>
            `;


            document
                .getElementById("supportForm")
                .reset();


            document
                .getElementById("productId")
                .innerHTML = `
                    <option value="">
                        Select an order first
                    </option>
                `;

            document
                .getElementById("productId")
                .disabled = true;


            loadRequests();


        } catch (error) {

            console.error(error);

            formMessage.innerHTML = `
                <div class="alert alert-danger">
                    ${escapeHTML(error.message)}
                </div>
            `;

        }

    });


// Load previous requests
async function loadRequests() {

    const container =
        document.getElementById(
            "requestsContainer"
        );


    try {

        const response = await fetch(
            `${API_URL}/support/my`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to load requests"
            );
        }


        if (
            !data.requests ||
            data.requests.length === 0
        ) {

            container.innerHTML = `
                <div class="alert alert-light border">
                    You have not submitted any support requests yet.
                </div>
            `;

            return;
        }


        container.innerHTML =
            data.requests
                .map(request => {

                    return `
                        <div class="card shadow-sm mb-3">

                            <div class="card-body">

                                <div class="d-flex justify-content-between align-items-start">

                                    <div>

                                        <h5 class="mb-1">
                                            ${formatType(request.type)}
                                        </h5>

                                        <small class="text-muted">
                                            Request #${request.id}
                                        </small>

                                    </div>

                                    <span class="badge ${getStatusClass(request.status)}">
                                        ${formatStatus(request.status)}
                                    </span>

                                </div>

                                <hr>

                                ${
                                    request.order_id
                                        ? `
                                            <p class="mb-1">
                                                <strong>Order:</strong>
                                                #${request.order_id}
                                            </p>
                                        `
                                        : ""
                                }

                                <p class="mb-1">
                                    <strong>Reason:</strong>
                                    ${escapeHTML(request.reason)}
                                </p>

                                <p class="mb-2">
                                    <strong>Description:</strong>
                                    ${escapeHTML(request.description)}
                                </p>

                                ${
                                    request.admin_response
                                        ? `
                                            <div class="alert alert-info mb-0">
                                                <strong>Admin Response:</strong><br>
                                                ${escapeHTML(request.admin_response)}
                                            </div>
                                        `
                                        : ""
                                }

                                <small class="text-muted d-block mt-3">
                                    Submitted:
                                    ${new Date(
                                        request.created_at
                                    ).toLocaleString()}
                                </small>

                            </div>

                        </div>
                    `;

                })
                .join("");


    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="alert alert-danger">
                Failed to load support requests.
            </div>
        `;

    }

}


function formatType(type) {

    const types = {

        support: "General Support",

        refund: "Refund Request",

        replacement: "Replacement Request"

    };

    return types[type] || type;
}


function formatStatus(status) {

    return status
        .replace("_", " ")
        .replace(
            /\b\w/g,
            letter => letter.toUpperCase()
        );
}


function getStatusClass(status) {

    const classes = {

        open: "bg-warning text-dark",

        in_review: "bg-info text-dark",

        approved: "bg-success",

        rejected: "bg-danger",

        resolved: "bg-secondary"

    };

    return classes[status] || "bg-secondary";
}


function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Initial loading
loadOrders();
loadRequests();