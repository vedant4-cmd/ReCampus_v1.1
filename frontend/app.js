let currentUser = null;
let categories = [];
let colleges = [];


// ============================================================
// API
// ============================================================

async function apiRequest(endpoint, options = {}) {

    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
        }

        throw new Error(
            data.message || "Request failed."
        );
    }

    return data;
}


// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatMoney(value) {

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}


function formatCondition(condition) {

    if (!condition) {
        return "N/A";
    }

    return condition
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}


function showToast(message, type = "dark") {

    const container =
        document.getElementById("toastContainer");

    const id =
        "toast-" + Date.now();

    container.insertAdjacentHTML(
        "beforeend",
        `
        <div
            id="${id}"
            class="toast align-items-center text-bg-${type} border-0"
            role="alert"
        >
            <div class="d-flex">

                <div class="toast-body">
                    ${escapeHtml(message)}
                </div>

                <button
                    type="button"
                    class="btn-close btn-close-white me-2 m-auto"
                    data-bs-dismiss="toast"
                ></button>

            </div>
        </div>
        `
    );

    const toastElement =
        document.getElementById(id);

    const toast =
        new bootstrap.Toast(toastElement, {
            delay: 3000
        });

    toast.show();

    toastElement.addEventListener(
        "hidden.bs.toast",
        () => toastElement.remove()
    );
}


// ============================================================
// SECTIONS
// ============================================================

function hideAllSections() {

    const sections = [
        "homeSection",
        "marketplaceSection",
        "productDetailsSection",
        "wishlistSection",
        "comparisonSection",
        "sellerDashboardSection",
        "createListingSection",
        "ordersSection",
        "adminDashboardSection"
    ];

    sections.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.classList.add("d-none");
        }
    });
}


function showHome() {

    hideAllSections();

    document
        .getElementById("homeSection")
        .classList.remove("d-none");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


async function showMarketplace() {

    hideAllSections();

    document
        .getElementById("marketplaceSection")
        .classList.remove("d-none");

    await loadMarketplace();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function showSection(id) {

    hideAllSections();

    document
        .getElementById(id)
        .classList.remove("d-none");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================================
// AUTH
// ============================================================

async function loadCurrentUser() {

    const token =
        localStorage.getItem("token");

    if (!token) {
        updateNavbar();
        return;
    }

    try {

        const data =
            await apiRequest("/auth/me");

        currentUser =
            data.user || data;

        localStorage.setItem(
            "user",
            JSON.stringify(currentUser)
        );

    } catch (error) {

        currentUser = null;

        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }

    updateNavbar();
}


function updateNavbar() {

    const loginButton =
        document.getElementById("loginNavButton");

    const registerButton =
        document.getElementById("registerNavButton");

    const logoutButton =
        document.getElementById("logoutNavButton");

    const welcomeUser =
        document.getElementById("welcomeUser");

    const wishlistNav =
        document.getElementById("wishlistNavItem");

    const compareNav =
        document.getElementById("compareNavItem");

    const sellerNav =
        document.getElementById("sellerDashboardNavItem");

    const adminNav =
        document.getElementById("adminDashboardNavItem");

    const buyerNav =
        document.getElementById("buyerDashboardNavItem");


    if (currentUser) {

        loginButton.classList.add("d-none");
        registerButton.classList.add("d-none");
        buyerNav.classList.remove("d-none");

        logoutButton.classList.remove("d-none");

        welcomeUser.classList.remove("d-none");

        welcomeUser.textContent =
            `Hi, ${currentUser.name || "User"}`;

        wishlistNav.classList.remove("d-none");
        compareNav.classList.remove("d-none");


        if (
            currentUser.role === "seller" ||
            currentUser.role === "admin" 
        ) {
            sellerNav.classList.remove("d-none");
        } else {
            sellerNav.classList.add("d-none");
        }


        if (currentUser.role === "admin") {
            adminNav.classList.remove("d-none");
        } else {
            adminNav.classList.add("d-none");
        }

    } else {

        loginButton.classList.remove("d-none");
        registerButton.classList.remove("d-none");

        logoutButton.classList.add("d-none");

        welcomeUser.classList.add("d-none");

        wishlistNav.classList.add("d-none");
        compareNav.classList.add("d-none");
        sellerNav.classList.add("d-none");
        adminNav.classList.add("d-none");
        buyerNav.classList.add("d-none");
    }
}


function showLoginModal() {

    const modal =
        new bootstrap.Modal(
            document.getElementById("loginModal")
        );

    modal.show();
}


function showRegisterModal() {

    const modal =
        new bootstrap.Modal(
            document.getElementById("registerModal")
        );

    modal.show();
}


async function logoutUser() {

    try {

        await apiRequest("/auth/logout", {
            method: "POST"
        });

    } catch (error) {
        // Continue logout locally.
    }

    currentUser = null;

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    updateNavbar();

    showHome();

    showToast(
        "You have been logged out.",
        "secondary"
    );
}


// ============================================================
// REGISTRATION
// ============================================================

document
    .getElementById("registerForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const password =
            document.getElementById(
                "registerPassword"
            ).value;

        const confirmPassword =
            document.getElementById(
                "registerConfirmPassword"
            ).value;

        if (password !== confirmPassword) {

            showToast(
                "Passwords do not match.",
                "danger"
            );

            return;
        }


        try {

    const accountType =
    document.getElementById("registerAccountType").value;

const data = await apiRequest("/auth/register", {
    method: "POST",

    body: JSON.stringify({

        name:
            document.getElementById("registerName")
                .value.trim(),

        email:
            document.getElementById("registerEmail")
                .value.trim(),

        mobile:
            document.getElementById("registerMobile")
                .value.trim(),

        password,

        accountType,

        seller_type:
            accountType === "business"
                ? "business"
                : accountType === "student"
                    ? "student"
                    : null,

        business_name:
            accountType === "business"
                ? document.getElementById("registerBusinessName")
                    .value.trim()
                : null,

        owner_name:
            accountType === "business"
                ? document.getElementById("registerOwnerName")
                    .value.trim()
                : null
    })
});


    if (data.token) {

        localStorage.setItem(
            "token",
            data.token
        );
    }


    if (data.user) {

        currentUser =
            data.user;

        localStorage.setItem(
            "user",
            JSON.stringify(currentUser)
        );
    }


    updateNavbar();


    const modal =
        bootstrap.Modal.getInstance(
            document.getElementById(
                "registerModal"
            )
        );

    if (modal) {
        modal.hide();
    }


    showToast(
        data.message ||
        "Account created successfully.",
        "success"
    );


    if (currentUser) {

        await loadCurrentUser();

        if (
            currentUser.role === "seller"
        ) {
            showSellerDashboard();
        } else {
            showMarketplace();
        }

    }

}  catch (error) {

            showToast(
                error.message,
                "danger"
            );
        }
    });


// ============================================================
// LOGIN
// ============================================================

document
    .getElementById("loginForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        try {

            const data =
                await apiRequest("/auth/login", {

                    method: "POST",

                    body: JSON.stringify({
                        email:
                            document.getElementById(
                                "loginEmail"
                            ).value.trim(),

                        password:
                            document.getElementById(
                                "loginPassword"
                            ).value
                    })
                });


            if (data.token) {

                localStorage.setItem(
                    "token",
                    data.token
                );
            }


            currentUser =
                data.user || data;


            if (data.user) {

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );
            }


            updateNavbar();


            const modal =
                bootstrap.Modal.getInstance(
                    document.getElementById(
                        "loginModal"
                    )
                );

            if (modal) {
                modal.hide();
            }


            showToast(
                "Login successful.",
                "success"
            );


            await updateWishlistAndCompareCounts();

            showHome();

        } catch (error) {

            showToast(
                error.message,
                "danger"
            );
        }
    });


// ============================================================
// META DATA
// ============================================================

async function loadCategories() {

    try {

        const data =
            await apiRequest(
                "/products/meta/categories"
            );

        categories =
            data.categories || data || [];

        populateCategoryElements();

        renderHomeCategories();

    } catch (error) {

        console.error(
            "Categories error:",
            error
        );
    }
}


async function loadColleges() {

    try {

        const data =
            await apiRequest(
                "/products/meta/colleges"
            );

        colleges =
            data.colleges || data || [];

        populateCollegeElements();

    } catch (error) {

        console.error(
            "Colleges error:",
            error
        );
    }
}


function populateCategoryElements() {

    const filter =
        document.getElementById(
            "categoryFilter"
        );

    const productCategory =
        document.getElementById(
            "productCategory"
        );


    filter.innerHTML =
        `<option value="">All Categories</option>`;

    productCategory.innerHTML =
        `<option value="">Select Category</option>`;


    categories.forEach(category => {

        const option1 =
            document.createElement("option");

        option1.value =
            category.id;

        option1.textContent =
            category.name;

        filter.appendChild(option1);


        const option2 =
            document.createElement("option");

        option2.value =
            category.id;

        option2.textContent =
            category.name;

        productCategory.appendChild(option2);
    });
}


function populateCollegeElements() {

    const productCollege =
        document.getElementById(
            "productCollege"
        );

    productCollege.innerHTML =
        `<option value="">Select College</option>`;


    colleges.forEach(college => {

        const option =
            document.createElement("option");

        option.value =
            college.id;

        option.textContent =
            college.name;

        productCollege.appendChild(option);
    });
}


function renderHomeCategories() {

    const container =
        document.getElementById(
            "homeCategories"
        );

    if (!categories.length) {

        container.innerHTML =
            `<div class="text-muted">
                No categories available.
            </div>`;

        return;
    }


    container.innerHTML =
        categories.map(category => `
            <div class="col-6 col-md-3">

                <button
                    class="category-card w-100"
                    onclick="openCategory(${category.id})"
                >

                    <i class="bi bi-grid"></i>

                    <span>
                        ${escapeHtml(category.name)}
                    </span>

                </button>

            </div>
        `).join("");
}


function openCategory(categoryId) {

    showMarketplace();

    setTimeout(() => {

        document.getElementById(
            "categoryFilter"
        ).value = categoryId;

        loadMarketplace();

    }, 100);
}


// ============================================================
// MARKETPLACE
// ============================================================

async function loadMarketplace() {

    const container =
        document.getElementById(
            "marketplaceProducts"
        );

    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border"></div>
            <p class="mt-3 text-muted">
                Loading products...
            </p>
        </div>
    `;


    const params =
        new URLSearchParams();


    const search =
        document.getElementById(
            "searchInput"
        ).value.trim();

    const maxPrice =
        document.getElementById(
            "maxPriceInput"
        ).value;

    const category =
        document.getElementById(
            "categoryFilter"
        ).value;

    const condition =
        document.getElementById(
            "conditionFilter"
        ).value;

    const sort =
        document.getElementById(
            "sortFilter"
        ).value;


    if (search) {
        params.set("search", search);
    }

    if (maxPrice) {
        params.set("maxPrice", maxPrice);
    }

    if (category) {
        params.set("category_id", category);
    }

    if (condition) {
        params.set("condition", condition);
    }

    if (sort) {
        params.set("sort", sort);
    }


    try {

        const data =
            await apiRequest(
                `/products?${params.toString()}`
            );

        const products =
            data.products || data || [];


        if (!products.length) {

            container.innerHTML = `
                <div class="col-12">

                    <div class="empty-state">

                        <i class="bi bi-box"></i>

                        <h4>
                            No products found
                        </h4>

                        <p>
                            Try changing your search or filters.
                        </p>

                    </div>

                </div>
            `;

            return;
        }


        container.innerHTML =
            products.map(
                productCard
            ).join("");


    } catch (error) {

        container.innerHTML = `
            <div class="col-12">

                <div class="alert alert-danger">
                    ${escapeHtml(error.message)}
                </div>

            </div>
        `;
    }
}


function productCard(product) {

    const image =
        product.image_url ||
        product.primary_image ||
        "";


    return `
        <div class="col-sm-6 col-lg-4">

            <div class="card product-card h-100 shadow-sm">

                ${
                    image
                    ?
                    `<img
                        src="${escapeHtml(image)}"
                        class="card-img-top product-image"
                        alt="${escapeHtml(product.name)}"
                        onerror="this.style.display='none'"
                    >`
                    :
                    `<div class="product-placeholder">
                        <i class="bi bi-box-seam"></i>
                    </div>`
                }


                <div class="card-body d-flex flex-column">

                    <div class="d-flex justify-content-between">

                        <span class="badge bg-light text-dark">
                            ${escapeHtml(
                                product.category_name ||
                                "General"
                            )}
                        </span>

                        <span class="badge bg-secondary">
                            ${escapeHtml(
                                formatCondition(
                                    product.condition
                                )
                            )}
                        </span>

                    </div>


                    <h5 class="card-title mt-3">
                        ${escapeHtml(product.name)}
                    </h5>


                    <p class="text-muted small">
                        ${
                            escapeHtml(
                                product.college_name ||
                                "Campus Marketplace"
                            )
                        }
                    </p>


                    <h4 class="text-dark">
                        ${formatMoney(product.price)}
                    </h4>


                    <div class="mt-auto">

                        <button
                            class="btn btn-dark w-100 mb-2"
                            onclick="showProductDetails(${product.id})"
                        >
                            View Product
                        </button>


                        <div class="d-flex gap-2">

                            <button
                                class="btn btn-outline-danger flex-fill"
                                onclick="addToWishlist(${product.id})"
                                title="Add to Wishlist"
                            >
                                <i class="bi bi-heart"></i>
                            </button>

                            <button
                                class="btn btn-outline-primary flex-fill"
                                onclick="addToComparison(${product.id})"
                                title="Compare"
                            >
                                <i class="bi bi-arrow-left-right"></i>
                            </button>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    `;
}


// ============================================================
// PRODUCT DETAILS
// ============================================================

async function showProductDetails(productId) {

    showSection("productDetailsSection");

    const container =
        document.getElementById("productDetails");

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border"></div>
        </div>
    `;

    try {

        // Load product details and review data together
        const [productData, reviewSummary, reviews] =
            await Promise.all([
                apiRequest(`/products/${productId}`),
                apiRequest(`/reviews/product/${productId}/summary`),
                apiRequest(`/reviews/product/${productId}`)
            ]);

        const product =
            productData.product || productData;

        const image =
            product.image_url ||
            product.primary_image ||
            (
                product.images &&
                product.images.length
                    ? product.images[0].image_url
                    : ""
            );

        const averageRating =
            Number(reviewSummary.average_rating || 0);

        const reviewCount =
            Number(reviewSummary.review_count || 0);

        const ratingDistribution =
            reviewSummary.rating_distribution || [];


        // Create rating stars
        function renderStars(rating) {

            const roundedRating =
                Math.round(Number(rating));

            let stars = "";

            for (let i = 1; i <= 5; i++) {

                stars += i <= roundedRating
                    ? `<i class="bi bi-star-fill text-warning"></i>`
                    : `<i class="bi bi-star text-warning"></i>`;
            }

            return stars;
        }


        // Rating distribution lookup
        const distribution = {};

        ratingDistribution.forEach(item => {
            distribution[Number(item.rating)] =
                Number(item.count);
        });


        // Reviews HTML
        const reviewsHtml =
            reviews.length > 0
                ?
                reviews.map(review => `

                    <div class="border-bottom py-3">

                        <div
                            class="d-flex justify-content-between align-items-start"
                        >

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        review.reviewer_name ||
                                        "Student"
                                    )}
                                </strong>

                                <div class="mt-1">
                                    ${renderStars(review.rating)}
                                </div>

                            </div>

                            <small class="text-muted">
                                ${
                                    review.created_at
                                        ? new Date(
                                            review.created_at
                                        ).toLocaleDateString()
                                        : ""
                                }
                            </small>

                        </div>


                        ${
                            review.comment
                                ?
                                `<p class="mb-0 mt-2 text-muted">
                                    ${escapeHtml(review.comment)}
                                </p>`
                                :
                                `<p class="mb-0 mt-2 text-muted">
                                    No comment provided.
                                </p>`
                        }

                    </div>

                `).join("")
                :
                `
                    <div class="text-center py-4 text-muted">

                        <i
                            class="bi bi-chat-square-text fs-2"
                        ></i>

                        <p class="mt-2 mb-0">
                            No reviews yet.
                        </p>

                        <small>
                            Be the first student to review this product.
                        </small>

                    </div>
                `;


        container.innerHTML = `

            <!-- PRODUCT DETAILS -->

            <div class="card shadow-sm mb-4">

                <div class="card-body">

                    <div class="row g-4">

                        <!-- PRODUCT IMAGE -->

                        <div class="col-md-5">

                            ${
                                image
                                    ?
                                    `<img
                                        src="${escapeHtml(image)}"
                                        class="img-fluid rounded product-detail-image"
                                        alt="${escapeHtml(product.name)}"
                                    >`
                                    :
                                    `<div class="product-detail-placeholder">
                                        <i class="bi bi-image"></i>
                                    </div>`
                            }

                        </div>


                        <!-- PRODUCT INFORMATION -->

                        <div class="col-md-7">

                            <span class="badge bg-secondary">

                                ${escapeHtml(
                                    formatCondition(
                                        product.condition
                                    )
                                )}

                            </span>


                            <h1 class="fw-bold mt-3">

                                ${escapeHtml(
                                    product.name
                                )}

                            </h1>


                            <h2 class="mb-3">

                                ${formatMoney(
                                    product.price
                                )}

                            </h2>


                            ${
                                product.original_price
                                    ?
                                    `<p class="text-muted">

                                        Original Price:
                                        ${formatMoney(
                                            product.original_price
                                        )}

                                    </p>`
                                    :
                                    ""
                            }


                            <p>

                                ${escapeHtml(
                                    product.description ||
                                    "No description available."
                                )}

                            </p>


                            <hr>


                            <p>

                                <strong>
                                    Category:
                                </strong>

                                ${escapeHtml(
                                    product.category_name ||
                                    "N/A"
                                )}

                            </p>


                            <p>

                                <strong>
                                    College:
                                </strong>

                                ${escapeHtml(
                                    product.college_name ||
                                    "N/A"
                                )}

                            </p>


                            <p>

                                <strong>
                                    Seller:
                                </strong>

                                ${escapeHtml(
                                    product.seller_name ||
                                    "Student Seller"
                                )}

                            </p>


                            <p>

                                <strong>
                                    Available:
                                </strong>

                                ${Number(
                                    product.available_quantity ??
                                    product.quantity ??
                                    0
                                )}

                            </p>


                            <!-- PRODUCT RATING SUMMARY -->

                            <div class="mt-3">

                                <div class="d-flex align-items-center gap-2">

                                    <span class="fs-5">

                                        ${renderStars(
                                            averageRating
                                        )}

                                    </span>

                                    <strong>

                                        ${
                                            averageRating > 0
                                                ? averageRating.toFixed(1)
                                                : "No rating"
                                        }

                                    </strong>

                                    <span class="text-muted">

                                        ${
                                            reviewCount
                                        }
                                        ${
                                            reviewCount === 1
                                                ? "review"
                                                : "reviews"
                                        }

                                    </span>

                                </div>

                            </div>


                            <!-- ACTION BUTTONS -->

                            <div class="d-flex gap-2 mt-4 flex-wrap">

                                <button
                                    class="btn btn-danger"
                                    onclick="addToWishlist(${product.id})"
                                >

                                    <i class="bi bi-heart"></i>

                                    Wishlist

                                </button>


                                <button
                                    class="btn btn-outline-primary"
                                    onclick="addToComparison(${product.id})"
                                >

                                    <i class="bi bi-arrow-left-right"></i>

                                    Compare

                                </button>


                                <button
                                    class="btn btn-outline-dark"
                                    onclick="openMessageSellerModal(
                                        ${product.seller_id},
                                        ${product.id},
                                        '${escapeHtml(product.name).replace(/'/g, "\\'")}'
                                    )"
                                >

                                    <i class="bi bi-chat-dots"></i>

                                    Contact Seller

                                </button>


                                <button
                                    class="btn btn-dark"
                                    onclick="buyProduct(${product.id})"
                                >

                                    Buy Now

                                </button>

                            </div>

                        </div>

                    </div>

                </div>

            </div>


            <!-- REVIEWS -->

            <div class="card shadow-sm mb-4">

                <div class="card-header">

                    <h4 class="mb-0 fw-bold">

                        <i class="bi bi-star-fill me-2"></i>

                        Customer Reviews

                    </h4>

                </div>


                <div class="card-body">

                    ${
                        reviewCount > 0
                            ?
                            `
                            <!-- REVIEW SUMMARY -->

                            <div class="row mb-4">

                                <div class="col-md-4 text-center">

                                    <div class="display-5 fw-bold">

                                        ${averageRating.toFixed(1)}

                                    </div>

                                    <div class="fs-5">

                                        ${renderStars(
                                            averageRating
                                        )}

                                    </div>

                                    <div class="text-muted mt-1">

                                        ${reviewCount}
                                        ${
                                            reviewCount === 1
                                                ? "review"
                                                : "reviews"
                                        }

                                    </div>

                                </div>


                                <div class="col-md-8">

                                    ${[5, 4, 3, 2, 1].map(rating => {

                                        const count =
                                            distribution[rating] || 0;

                                        const percentage =
                                            reviewCount > 0
                                                ? (
                                                    count /
                                                    reviewCount
                                                ) * 100
                                                : 0;

                                        return `

                                            <div
                                                class="d-flex align-items-center mb-2"
                                            >

                                                <div
                                                    style="width:55px;"
                                                    class="small"
                                                >
                                                    ${rating}
                                                    <i
                                                        class="bi bi-star-fill text-warning"
                                                    ></i>
                                                </div>


                                                <div
                                                    class="progress flex-grow-1 mx-2"
                                                    style="height:8px;"
                                                >

                                                    <div
                                                        class="progress-bar"
                                                        role="progressbar"
                                                        style="width:${percentage}%"
                                                    ></div>

                                                </div>


                                                <div
                                                    style="width:35px;"
                                                    class="small text-muted"
                                                >
                                                    ${count}
                                                </div>

                                            </div>

                                        `;

                                    }).join("")}

                                </div>

                            </div>
                            `
                            :
                            ""
                    }


                    <!-- INDIVIDUAL REVIEWS -->

                    <div>

                        ${reviewsHtml}

                    </div>

                </div>

            </div>

        `;
        

    } catch (error) {

        console.error(
            "Product details error:",
            error
        );

        container.innerHTML = `

            <div class="alert alert-danger">

                ${escapeHtml(
                    error.message
                )}

            </div>

        `;
    }
}

// ============================================================
// WISHLIST
// ============================================================

async function addToWishlist(productId) {

    if (!currentUser) {

        showToast(
            "Please login to use Wishlist.",
            "warning"
        );

        showLoginModal();

        return;
    }


    try {

        const data =
            await apiRequest(
                `/wishlist/${productId}`,
                {
                    method: "POST"
                }
            );


        showToast(
            data.message ||
            "Added to wishlist.",
            "success"
        );


        await updateWishlistAndCompareCounts();


    } catch (error) {

        showToast(
            error.message,
            "danger"
        );
    }
}


async function removeFromWishlist(productId) {

    try {

        const data =
            await apiRequest(
                `/wishlist/${productId}`,
                {
                    method: "DELETE"
                }
            );


        showToast(
            data.message ||
            "Removed from wishlist.",
            "success"
        );


        await loadWishlist();


    } catch (error) {

        showToast(
            error.message,
            "danger"
        );
    }
}


async function showWishlist() {

    if (!currentUser) {

        showLoginModal();

        return;
    }

    showSection("wishlistSection");

    await loadWishlist();
}


async function loadWishlist() {

    const container =
        document.getElementById(
            "wishlistProducts"
        );


    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border"></div>
        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/wishlist"
            );

        const products =
            data.items || [];


        if (!products.length) {

            container.innerHTML = `
                <div class="col-12">

                    <div class="empty-state">

                        <i class="bi bi-heart"></i>

                        <h4>
                            Your wishlist is empty
                        </h4>

                        <p>
                            Save products here when you find something interesting.
                        </p>

                        <button
                            class="btn btn-dark"
                            onclick="showMarketplace()"
                        >
                            Browse Marketplace
                        </button>

                    </div>

                </div>
            `;

            updateWishlistCount(0);

            return;
        }


        updateWishlistCount(products.length);


        container.innerHTML =
            products.map(item => `

                <div class="col-sm-6 col-lg-4">

                    <div class="card product-card h-100 shadow-sm">

                        ${
                            item.image_url
                            ?
                            `<img
                                src="${escapeHtml(item.image_url)}"
                                class="card-img-top product-image"
                                alt="${escapeHtml(item.name)}"
                            >`
                            :
                            `<div class="product-placeholder">
                                <i class="bi bi-box-seam"></i>
                            </div>`
                        }


                        <div class="card-body d-flex flex-column">

                            <h5>
                                ${escapeHtml(item.name)}
                            </h5>

                            <p class="text-muted">
                                ${escapeHtml(
                                    item.category_name ||
                                    "General"
                                )}
                            </p>

                            <h4>
                                ${formatMoney(item.price)}
                            </h4>

                            <p class="small text-muted">
                                ${escapeHtml(
                                    item.college_name ||
                                    ""
                                )}
                            </p>


                            <div class="mt-auto">

                                <button
                                    class="btn btn-dark w-100 mb-2"
                                    onclick="showProductDetails(${item.id})"
                                >
                                    View Product
                                </button>

                                <button
                                    class="btn btn-outline-danger w-100"
                                    onclick="removeFromWishlist(${item.id})"
                                >
                                    <i class="bi bi-trash"></i>
                                    Remove
                                </button>

                            </div>

                        </div>

                    </div>

                </div>

            `).join("");


    } catch (error) {

        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    ${escapeHtml(error.message)}
                </div>
            </div>
        `;
    }
}


function updateWishlistCount(count) {

    document.getElementById(
        "wishlistCountBadge"
    ).textContent = count;
}


// ============================================================
// COMPARISON
// ============================================================

async function addToComparison(productId) {

    if (!currentUser) {

        showToast(
            "Please login to compare products.",
            "warning"
        );

        showLoginModal();

        return;
    }


    try {

        const data =
            await apiRequest(
                `/comparison/${productId}`,
                {
                    method: "POST"
                }
            );


        showToast(
            data.message ||
            "Added to comparison.",
            "success"
        );


        await updateWishlistAndCompareCounts();


    } catch (error) {

        showToast(
            error.message,
            "danger"
        );
    }
}


async function removeFromComparison(productId) {

    try {

        const data =
            await apiRequest(
                `/comparison/${productId}`,
                {
                    method: "DELETE"
                }
            );


        showToast(
            data.message ||
            "Removed from comparison.",
            "success"
        );


        await loadComparison();


    } catch (error) {

        showToast(
            error.message,
            "danger"
        );
    }
}


async function showComparison() {

    if (!currentUser) {

        showLoginModal();

        return;
    }

    showSection("comparisonSection");

    await loadComparison();
}


async function loadComparison() {

    const container =
        document.getElementById(
            "comparisonContent"
        );


    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border"></div>
        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/comparison"
            );

        const products =
            data.items || [];


        updateCompareCount(
            products.length
        );


        if (!products.length) {

            container.innerHTML = `
                <div class="empty-state">

                    <i class="bi bi-arrow-left-right"></i>

                    <h4>
                        Nothing to compare
                    </h4>

                    <p>
                        Add products from the marketplace to compare them.
                    </p>

                    <button
                        class="btn btn-dark"
                        onclick="showMarketplace()"
                    >
                        Browse Marketplace
                    </button>

                </div>
            `;

            return;
        }


        container.innerHTML = `

            <div class="table-responsive">

                <table class="table table-bordered comparison-table">

                    <thead class="table-dark">

                        <tr>

                            <th>
                                Feature
                            </th>

                            ${
                                products.map(product => `
                                    <th>
                                        ${escapeHtml(product.name)}
                                    </th>
                                `).join("")
                            }

                        </tr>

                    </thead>


                    <tbody>

                        <tr>

                            <th>
                                Image
                            </th>

                            ${
                                products.map(product => `
                                    <td>
                                        ${
                                            product.image_url
                                            ?
                                            `<img
                                                src="${escapeHtml(product.image_url)}"
                                                class="compare-image"
                                            >`
                                            :
                                            `<i class="bi bi-image fs-1 text-muted"></i>`
                                        }
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                Price
                            </th>

                            ${
                                products.map(product => `
                                    <td class="fw-bold">
                                        ${formatMoney(product.price)}
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                Condition
                            </th>

                            ${
                                products.map(product => `
                                    <td>
                                        ${escapeHtml(
                                            formatCondition(
                                                product.condition
                                            )
                                        )}
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                Category
                            </th>

                            ${
                                products.map(product => `
                                    <td>
                                        ${escapeHtml(
                                            product.category_name ||
                                            "N/A"
                                        )}
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                College
                            </th>

                            ${
                                products.map(product => `
                                    <td>
                                        ${escapeHtml(
                                            product.college_name ||
                                            "N/A"
                                        )}
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                Seller
                            </th>

                            ${
                                products.map(product => `
                                    <td>
                                        ${escapeHtml(
                                            product.seller_name ||
                                            "N/A"
                                        )}
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                Available
                            </th>

                            ${
                                products.map(product => `
                                    <td>
                                        ${
                                            Number(
                                                product.available_quantity ??
                                                product.quantity ??
                                                0
                                            )
                                        }
                                    </td>
                                `).join("")
                            }

                        </tr>


                        <tr>

                            <th>
                                Actions
                            </th>

                            ${
                                products.map(product => `
                                    <td>

                                        <button
                                            class="btn btn-sm btn-dark mb-1"
                                            onclick="showProductDetails(${product.id})"
                                        >
                                            View
                                        </button>

                                        <button
                                            class="btn btn-sm btn-outline-danger mb-1"
                                            onclick="removeFromComparison(${product.id})"
                                        >
                                            Remove
                                        </button>

                                    </td>
                                `).join("")
                            }

                        </tr>

                    </tbody>

                </table>

            </div>
        `;


    } catch (error) {

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}


function updateCompareCount(count) {

    document.getElementById(
        "compareCountBadge"
    ).textContent = count;
}


async function updateWishlistAndCompareCounts() {

    if (!currentUser) {

        updateWishlistCount(0);
        updateCompareCount(0);

        return;
    }


    try {

        const wishlist =
            await apiRequest(
                "/wishlist"
            );

        updateWishlistCount(
            wishlist.count || 0
        );

    } catch {
        updateWishlistCount(0);
    }


    try {

        const comparison =
            await apiRequest(
                "/comparison"
            );

        updateCompareCount(
            comparison.count || 0
        );

    } catch {
        updateCompareCount(0);
    }
}


// ============================================================
// BUY PRODUCT
// ============================================================

async function buyProduct(productId) {
    try {
        const numericProductId = Number(productId);

        if (
            !Number.isInteger(numericProductId) ||
            numericProductId <= 0
        ) {
            showToast("Invalid product", "danger");
            return;
        }

        showToast("Creating your order...", "dark");

        const token = localStorage.getItem("token");

        if (!token) {
            showToast("Please login first.", "danger");
            return;
        }

        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                items: [
                    {
                        product_id: numericProductId,
                        quantity: 1
                    }
                ]
            })
        });

        const data = await response.json();

        console.log("Create order response:", data);

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to create order."
            );
        }

        if (!data.id) {
            throw new Error("Order was not created.");
        }

        showToast("Order created. Opening payment...", "dark");

        await startRazorpayPayment(data.id);

    } catch (error) {
        console.error("Buy Now error:", error);

        showToast(
            error.message || "Unable to place order.",
            "danger"
        );
    }
}


// ============================================================
// SELLER DASHBOARD
// ============================================================

function showSellerDashboard() {

    if (!currentUser) {
        showLoginModal();
        return;
    }

    if (
        currentUser.role !== "seller" &&
        currentUser.role !== "admin"
    ) {
        showToast(
            "You need seller access.",
            "warning"
        );
        return;
    }

    showSection("sellerDashboardSection");

    loadSellerProducts();
    loadSellerOrders();
}


// ============================================================
// SELLER PRODUCTS
// ============================================================

async function loadSellerProducts() {

    const container =
        document.getElementById(
            "sellerProducts"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border"></div>
            <p class="text-muted mt-2">
                Loading products...
            </p>
        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/products/mine"
            );


        const products =
            data.products ||
            data ||
            [];


        const countElement =
            document.getElementById(
                "sellerProductCount"
            );


        if (countElement) {

            countElement.textContent =
                products.length;

        }


        if (!products.length) {

            container.innerHTML = `
                <div class="empty-state">

                    <i class="bi bi-box-seam"></i>

                    <h5>
                        You haven't listed any products.
                    </h5>

                    <button
                        class="btn btn-dark"
                        onclick="showCreateListing()"
                    >
                        Add Product
                    </button>

                </div>
            `;

            return;
        }


        container.innerHTML = `

            <div class="table-responsive">

                <table class="table align-middle">

                    <thead>

                        <tr>

                            <th>
                                Product
                            </th>

                            <th>
                                Price
                            </th>

                            <th>
                                Stock
                            </th>

                            <th>
                                Status
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            products.map(product => `

                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHtml(
                                                product.name
                                            )}
                                        </strong>
                                    </td>


                                    <td>
                                        ${formatMoney(
                                            product.price
                                        )}
                                    </td>


                                    <td>
                                        ${
                                            product.available_quantity ??
                                            product.quantity ??
                                            0
                                        }
                                    </td>


                                    <td>

                                        <span class="badge bg-secondary">

                                            ${escapeHtml(
                                                product.status ||
                                                "active"
                                            )}

                                        </span>

                                    </td>

                                </tr>

                            `).join("")
                        }

                    </tbody>

                </table>

            </div>
        `;


    } catch (error) {

        console.error(
            "Seller products error:",
            error
        );


        container.innerHTML = `
            <div class="alert alert-danger">

                ${escapeHtml(
                    error.message ||
                    "Unable to load products."
                )}

            </div>
        `;
    }
}


// ============================================================
// SELLER ORDERS + REVENUE
// ============================================================

async function loadSellerOrders() {

    const container =
        document.getElementById(
            "sellerOrders"
        );


    if (!container) {

        console.error(
            "sellerOrders container not found."
        );

        return;
    }


    container.innerHTML = `
        <div class="text-center py-4">

            <div class="spinner-border"></div>

            <p class="text-muted mt-2">
                Loading orders...
            </p>

        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/orders/seller/orders"
            );


        /*
        ------------------------------------------------
        New backend response
        ------------------------------------------------
        */

        const orders =
            Array.isArray(data)
                ? data
                : (
                    data.orders ||
                    []
                );


        const stats =
            data.stats || {};


        /*
        ------------------------------------------------
        Update seller statistics
        ------------------------------------------------
        */

        const orderCountElement =
            document.getElementById(
                "sellerOrderCount"
            );


        if (orderCountElement) {

            orderCountElement.textContent =
                stats.orders ??
                orders.filter(
                    order =>
                        order.payment_status === "paid"
                ).length;

        }


        const revenueElement =
            document.getElementById(
                "sellerRevenue"
            );


        if (revenueElement) {

            revenueElement.textContent =
                formatMoney(
                    stats.revenue || 0
                );

        }


        /*
        ------------------------------------------------
        No orders
        ------------------------------------------------
        */

        if (!orders.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <i class="bi bi-cart-check"></i>

                    <h5>
                        No orders yet.
                    </h5>

                    <p class="text-muted">
                        Orders for your products
                        will appear here.
                    </p>

                </div>

            `;

            return;
        }


        /*
        ------------------------------------------------
        Render orders
        ------------------------------------------------
        */

        container.innerHTML = `

            <div class="table-responsive">

                <table class="table align-middle">

                    <thead>

                        <tr>

                            <th>
                                Order
                            </th>

                            <th>
                                Buyer
                            </th>

                            <th>
                                Product
                            </th>

                            <th>
                                Qty
                            </th>

                            <th>
                                Amount
                            </th>

                            <th>
                                Payment
                            </th>

                            <th>
                                Status
                            </th>

                            <th>
                                Action
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            orders.map(order => `

                                <tr>

                                    <td>

                                        <strong>
                                            #${order.id}
                                        </strong>

                                        <br>

                                        <small class="text-muted">

                                            ${new Date(
                                                order.created_at
                                            ).toLocaleDateString()}

                                        </small>

                                    </td>


                                    <td>

                                        <strong>
                                            ${escapeHtml(
                                                order.buyer_name ||
                                                "Buyer"
                                            )}
                                        </strong>

                                        <br>

                                        <small class="text-muted">

                                            ${escapeHtml(
                                                order.buyer_email ||
                                                ""
                                            )}

                                        </small>

                                    </td>


                                    <td>

                                        ${escapeHtml(
                                            order.product_name ||
                                            "Product"
                                        )}

                                    </td>


                                    <td>
                                        ${Number(
                                            order.quantity || 0
                                        )}
                                    </td>


                                    <td>

                                        ${formatMoney(
                                            order.subtotal ||
                                            0
                                        )}

                                    </td>


                                    <td>

                                        <span
                                            class="badge ${
                                                order.payment_status === "paid"
                                                    ? "bg-success"
                                                    : "bg-warning text-dark"
                                            }"
                                        >

                                            ${escapeHtml(
                                                order.payment_status ||
                                                "pending"
                                            )}

                                        </span>

                                    </td>


                                    <td>

                                        <span
                                            class="badge bg-secondary"
                                        >

                                            ${escapeHtml(
                                                order.order_status ||
                                                "placed"
                                            )}

                                        </span>

                                    </td>


                                    <td>

                                        ${
                                            order.payment_status === "paid" &&
                                            ![
                                                "delivered",
                                                "cancelled",
                                                "returned"
                                            ].includes(
                                                order.order_status
                                            )

                                            ?

                                            `

                                                <select
                                                    class="form-select form-select-sm"
                                                    onchange="
                                                        updateSellerOrderStatus(
                                                            ${order.id},
                                                            this.value
                                                        )
                                                    "
                                                >

                                                    <option
                                                        value="confirmed"
                                                        ${
                                                            order.order_status === "confirmed"
                                                                ? "selected"
                                                                : ""
                                                        }
                                                    >
                                                        Confirmed
                                                    </option>


                                                    <option
                                                        value="processing"
                                                        ${
                                                            order.order_status === "processing"
                                                                ? "selected"
                                                                : ""
                                                        }
                                                    >
                                                        Processing
                                                    </option>


                                                    <option
                                                        value="shipped"
                                                        ${
                                                            order.order_status === "shipped"
                                                                ? "selected"
                                                                : ""
                                                        }
                                                    >
                                                        Shipped
                                                    </option>


                                                    <option
                                                        value="delivered"
                                                        ${
                                                            order.order_status === "delivered"
                                                                ? "selected"
                                                                : ""
                                                        }
                                                    >
                                                        Delivered
                                                    </option>

                                                </select>

                                            `

                                            :

                                            `

                                                <span class="text-muted small">

                                                    ${
                                                        order.order_status === "delivered"
                                                            ? "Completed"
                                                            : "Payment required"
                                                    }

                                                </span>

                                            `
                                        }

                                    </td>

                                </tr>

                            `).join("")
                        }

                    </tbody>

                </table>

            </div>

        `;


    } catch (error) {

        console.error(
            "Seller orders error:",
            error
        );


        container.innerHTML = `

            <div class="alert alert-danger">

                ${escapeHtml(
                    error.message ||
                    "Unable to load seller orders."
                )}

            </div>

        `;
    }
}


// ============================================================
// UPDATE SELLER ORDER STATUS
// ============================================================

async function updateSellerOrderStatus(
    orderId,
    status
) {

    if (
        !orderId ||
        !status
    ) {
        return;
    }


    try {

        const data =
            await apiRequest(
                `/orders/seller/${orderId}/status`,
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        status: status
                    })
                }
            );


        showToast(
            data.message ||
            "Order status updated successfully.",
            "success"
        );


        await loadSellerOrders();


    } catch (error) {

        console.error(
            "Update seller order status error:",
            error
        );


        showToast(
            error.message ||
            "Unable to update order status.",
            "danger"
        );


        await loadSellerOrders();
    }
}

async function loadSellerOrders() {

    const container =
        document.getElementById("sellerOrders");

    if (!container) {
        console.error("sellerOrders container not found.");
        return;
    }

    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border"></div>
            <p class="text-muted mt-2">
                Loading orders...
            </p>
        </div>
    `;

    try {

        const data =
            await apiRequest("/orders/seller/orders");

        const orders =
            Array.isArray(data)
                ? data
                : (data.orders || []);

        /*
        --------------------------------------------
        Seller statistics
        --------------------------------------------
        */

        const paidOrders =
            orders.filter(
                order =>
                    order.payment_status === "paid"
            );

        const revenue =
            paidOrders.reduce(
                (total, order) =>
                    total + Number(order.subtotal || 0),
                0
            );

        const uniqueOrderIds =
            new Set(
                paidOrders.map(
                    order => order.id
                )
            );

        document.getElementById(
            "sellerOrderCount"
        ).textContent =
            uniqueOrderIds.size;

        document.getElementById(
            "sellerRevenue"
        ).textContent =
            formatMoney(revenue);


        /*
        --------------------------------------------
        No orders
        --------------------------------------------
        */

        if (!orders.length) {

            container.innerHTML = `
                <div class="empty-state">

                    <i class="bi bi-cart-check"></i>

                    <h5>
                        No orders yet.
                    </h5>

                    <p class="text-muted">
                        Orders for your products
                        will appear here.
                    </p>

                </div>
            `;

            return;
        }


        /*
        --------------------------------------------
        Orders table
        --------------------------------------------
        */

        container.innerHTML = `

            <div class="table-responsive">

                <table class="table align-middle">

                    <thead>

                        <tr>
                            <th>Order</th>
                            <th>Buyer</th>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Amount</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${
                            orders.map(order => `

                                <tr>

                                    <td>
                                        <strong>
                                            #${order.id}
                                        </strong>

                                        <br>

                                        <small class="text-muted">
                                            ${new Date(
                                                order.created_at
                                            ).toLocaleDateString()}
                                        </small>
                                    </td>


                                    <td>

                                        <strong>
                                            ${escapeHtml(
                                                order.buyer_name ||
                                                "Buyer"
                                            )}
                                        </strong>

                                        <br>

                                        <small class="text-muted">
                                            ${escapeHtml(
                                                order.buyer_email ||
                                                ""
                                            )}
                                        </small>

                                    </td>


                                    <td>
                                        ${escapeHtml(
                                            order.product_name ||
                                            "Product"
                                        )}
                                    </td>


                                    <td>
                                        ${Number(
                                            order.quantity || 0
                                        )}
                                    </td>


                                    <td>
                                        ${formatMoney(
                                            order.subtotal || 0
                                        )}
                                    </td>


                                    <td>

                                        <span class="badge ${
                                            order.payment_status === "paid"
                                                ? "bg-success"
                                                : "bg-warning text-dark"
                                        }">

                                            ${escapeHtml(
                                                order.payment_status ||
                                                "pending"
                                            )}

                                        </span>

                                    </td>


                                    <td>

                                        <span class="badge bg-secondary">

                                            ${escapeHtml(
                                                order.order_status ||
                                                "placed"
                                            )}

                                        </span>

                                    </td>


                                    <td>

                                        ${
                                            order.payment_status === "paid" &&
                                            ![
                                                "delivered",
                                                "cancelled",
                                                "returned"
                                            ].includes(
                                                order.order_status
                                            )

                                            ?

                                            `
                                            <select
                                                class="form-select form-select-sm"
                                                onchange="
                                                    updateSellerOrderStatus(
                                                        ${order.id},
                                                        this.value
                                                    )
                                                "
                                            >

                                                <option
                                                    value="confirmed"
                                                    ${
                                                        order.order_status === "confirmed"
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    Confirmed
                                                </option>

                                                <option
                                                    value="processing"
                                                    ${
                                                        order.order_status === "processing"
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    Processing
                                                </option>

                                                <option
                                                    value="shipped"
                                                    ${
                                                        order.order_status === "shipped"
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    Shipped
                                                </option>

                                                <option
                                                    value="delivered"
                                                    ${
                                                        order.order_status === "delivered"
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    Delivered
                                                </option>

                                            </select>
                                            `

                                            :

                                            `
                                            <span class="text-muted small">
                                                ${
                                                    order.order_status === "delivered"
                                                        ? "Completed"
                                                        : "Payment required"
                                                }
                                            </span>
                                            `
                                        }

                                    </td>

                                </tr>

                            `).join("")
                        }

                    </tbody>

                </table>

            </div>
        `;

    } catch (error) {

        console.error(
            "Seller orders error:",
            error
        );

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHtml(
                    error.message ||
                    "Unable to load seller orders."
                )}
            </div>
        `;
    }
}


async function loadSellerProducts() {

    const container =
        document.getElementById(
            "sellerProducts"
        );


    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border"></div>
        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/products/mine"
            );

        const products =
            data.products || data || [];


        document.getElementById(
            "sellerProductCount"
        ).textContent =
            products.length;


        if (!products.length) {

            container.innerHTML = `
                <div class="empty-state">

                    <i class="bi bi-box-seam"></i>

                    <h5>
                        You haven't listed any products.
                    </h5>

                    <button
                        class="btn btn-dark"
                        onclick="showCreateListing()"
                    >
                        Add Product
                    </button>

                </div>
            `;

            return;
        }


        container.innerHTML = `

            <div class="table-responsive">

                <table class="table align-middle">

                    <thead>

                        <tr>

                            <th>
                                Product
                            </th>

                            <th>
                                Price
                            </th>

                            <th>
                                Stock
                            </th>

                            <th>
                                Status
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${
                            products.map(product => `

                                <tr>

                                    <td>
                                        <strong>
                                            ${escapeHtml(product.name)}
                                        </strong>
                                    </td>

                                    <td>
                                        ${formatMoney(product.price)}
                                    </td>

                                    <td>
                                        ${
                                            product.available_quantity ??
                                            product.quantity ??
                                            0
                                        }
                                    </td>

                                    <td>
                                        <span class="badge bg-secondary">
                                            ${escapeHtml(
                                                product.status ||
                                                "active"
                                            )}
                                        </span>
                                    </td>

                                </tr>

                            `).join("")
                        }

                    </tbody>

                </table>

            </div>
        `;


    } catch (error) {

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}


function showCreateListing() {

    if (!currentUser) {

        showLoginModal();

        return;
    }


    showSection(
        "createListingSection"
    );

    loadCategories();
    loadColleges();
}


document
    .getElementById("createProductForm")
    .addEventListener("submit", async event => {

        event.preventDefault();


        try {

            const imageUrl =
                document.getElementById(
                    "productImage"
                ).value.trim();


            const images =
                imageUrl
                ?
                [imageUrl]
                :
                [];


            const data =
                await apiRequest(
                    "/products",
                    {
                        method: "POST",

                        body: JSON.stringify({

                            name:
                                document.getElementById(
                                    "productName"
                                ).value.trim(),

                            price:
                                Number(
                                    document.getElementById(
                                        "productPrice"
                                    ).value
                                ),

                            category_id:
                                Number(
                                    document.getElementById(
                                        "productCategory"
                                    ).value
                                ),

                            college_id:
                                document.getElementById(
                                    "productCollege"
                                ).value
                                ?
                                Number(
                                    document.getElementById(
                                        "productCollege"
                                    ).value
                                )
                                :
                                null,

                            condition:
                                document.getElementById(
                                    "productCondition"
                                ).value,

                            quantity:
                                Number(
                                    document.getElementById(
                                        "productQuantity"
                                    ).value
                                ),

                            description:
                                document.getElementById(
                                    "productDescription"
                                ).value.trim(),

                            images

                        })
                    }
                );


            showToast(
                data.message ||
                "Product created successfully.",
                "success"
            );


            document
                .getElementById(
                    "createProductForm"
                )
                .reset();


            showSellerDashboard();


        } catch (error) {

            showToast(
                error.message,
                "danger"
            );
        }
    });


// ============================================================
// ORDERS
// ============================================================

async function showOrders() {

    if (!currentUser) {

        showLoginModal();

        return;
    }


    showSection("ordersSection");

    await loadOrders();
}


async function loadOrders() {

    const container =
        document.getElementById("ordersList");

    try {

        const data =
            await apiRequest("/orders/my");

        const orders =
            Array.isArray(data)
                ? data
                : (data.orders || []);


        if (!orders.length) {

            container.innerHTML = `
                <div class="empty-state">

                    <i class="bi bi-cart"></i>

                    <h4>
                        No orders yet
                    </h4>

                </div>
            `;

            return;
        }


        container.innerHTML = orders.map(order => {

            const isDelivered =
                order.order_status === "delivered";


            /*
            --------------------------------------------
            Review button
            --------------------------------------------
            */

            const reviewButton =
                isDelivered

                    ? `
                        <button
                            class="btn btn-sm btn-outline-dark mt-2"
                            onclick="showReviewForm(${order.id})"
                        >
                            <i class="bi bi-star"></i>
                            Write Review
                        </button>
                    `

                    : "";


            return `

                <div class="card shadow-sm mb-3">

                    <div class="card-body">

                        <div class="row">

                            <div class="col-md-3">

                                <strong>
                                    Order #${order.id}
                                </strong>

                            </div>


                            <div class="col-md-3">

                                ${formatMoney(
                                    order.total_amount
                                )}

                            </div>


                            <div class="col-md-3">

                                <span class="badge bg-secondary">

                                    ${escapeHtml(
                                        order.order_status ||
                                        "placed"
                                    )}

                                </span>

                            </div>


                            <div class="col-md-3">

                                <span class="badge bg-info">

                                    ${escapeHtml(
                                        order.payment_status ||
                                        "pending"
                                    )}

                                </span>

                                ${reviewButton}

                            </div>

                        </div>

                    </div>

                </div>

            `;

        }).join("");


    } catch (error) {

        container.innerHTML = `

            <div class="alert alert-danger">

                ${escapeHtml(
                    error.message
                )}

            </div>

        `;

    }
}

function showReviewForm(orderId) {

    const rating =
        prompt(
            "Give this order a rating from 1 to 5:"
        );

    if (rating === null) {
        return;
    }


    const numericRating =
        Number(rating);


    if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
    ) {

        showToast(
            "Rating must be between 1 and 5.",
            "danger"
        );

        return;
    }


    const comment =
        prompt(
            "Write your review:"
        );


    submitOrderReview(
        orderId,
        numericRating,
        comment || ""
    );
}


// ============================================================
// ADMIN
// ============================================================

function showAdminDashboard() {

    if (
        !currentUser ||
        currentUser.role !== "admin"
    ) {

        showToast(
            "Admin access required.",
            "danger"
        );

        return;
    }


    showSection(
        "adminDashboardSection"
    );


    loadAdminStats();
    loadPendingSellers();
}


async function loadAdminStats() {

    const container =
        document.getElementById(
            "adminStats"
        );


    try {

        const data =
            await apiRequest(
                "/admin/stats"
            );


        const stats =
            data.stats || data;


        container.innerHTML = `

            <div class="col-md-3">

                <div class="dashboard-stat">

                    <i class="bi bi-people"></i>

                    <div>

                        <div class="stat-number">
                            ${stats.users ?? 0}
                        </div>

                        <div class="text-muted">
                            Users
                        </div>

                    </div>

                </div>

            </div>


            <div class="col-md-3">

                <div class="dashboard-stat">

                    <i class="bi bi-shop"></i>

                    <div>

                        <div class="stat-number">
                            ${stats.sellers ?? 0}
                        </div>

                        <div class="text-muted">
                            Sellers
                        </div>

                    </div>

                </div>

            </div>


            <div class="col-md-3">

                <div class="dashboard-stat">

                    <i class="bi bi-box-seam"></i>

                    <div>

                        <div class="stat-number">
                            ${stats.products ?? 0}
                        </div>

                        <div class="text-muted">
                            Products
                        </div>

                    </div>

                </div>

            </div>


            <div class="col-md-3">

                <div class="dashboard-stat">

                    <i class="bi bi-cart-check"></i>

                    <div>

                        <div class="stat-number">
                            ${stats.orders ?? 0}
                        </div>

                        <div class="text-muted">
                            Orders
                        </div>

                    </div>

                </div>

            </div>
        `;


    } catch (error) {

        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    ${escapeHtml(error.message)}
                </div>
            </div>
        `;
    }
}


async function loadPendingSellers() {

    const container =
        document.getElementById(
            "pendingSellers"
        );


    try {

        const data =
            await apiRequest(
                "/admin/sellers/pending"
            );

        const sellers =
            data.sellers || data || [];


        if (!sellers.length) {

            container.innerHTML = `
                <div class="alert alert-success">
                    No pending seller verifications.
                </div>
            `;

            return;
        }


        container.innerHTML =
            sellers.map(seller => `

                <div class="border rounded p-3 mb-3">

                    <div class="row align-items-center">

                        <div class="col-md-8">

                            <h5>
                                ${escapeHtml(
                                    seller.display_name ||
                                    seller.name
                                )}
                            </h5>

                            <p class="mb-1">
                                ${escapeHtml(
                                    seller.email ||
                                    ""
                                )}
                            </p>

                            <p class="mb-0 text-muted">
                                Seller Type:
                                ${escapeHtml(
                                    seller.seller_type ||
                                    "student"
                                )}
                            </p>

                        </div>


                        <div class="col-md-4 text-md-end mt-3 mt-md-0">

                            <button
                                class="btn btn-success me-2"
                                onclick="approveSeller(${seller.id})"
                            >
                                Approve
                            </button>

                            <button
                                class="btn btn-danger"
                                onclick="rejectSeller(${seller.id})"
                            >
                                Reject
                            </button>

                        </div>

                    </div>

                </div>

            `).join("");


    } catch (error) {

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}


async function approveSeller(sellerId) {

    try {

        const data =
            await apiRequest(
                `/admin/sellers/${sellerId}/approve`,
                {
                    method: "PATCH"
                }
            );


        showToast(
            data.message ||
            "Seller approved.",
            "success"
        );


        loadPendingSellers();
        loadAdminStats();


    } catch (error) {

        showToast(
            error.message,
            "danger"
        );
    }
}


async function rejectSeller(sellerId) {

    const reason =
        prompt(
            "Enter rejection reason:"
        );


    if (reason === null) {
        return;
    }


    try {

        const data =
            await apiRequest(
                `/admin/sellers/${sellerId}/reject`,
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        reason
                    })
                }
            );


        showToast(
            data.message ||
            "Seller rejected.",
            "success"
        );


        loadPendingSellers();
        loadAdminStats();


    } catch (error) {

        showToast(
            error.message,
            "danger"
        );
    }
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initializeApp() {

    await loadCurrentUser();

    await loadCategories();

    await loadColleges();

    await updateWishlistAndCompareCounts();

    showHome();
}

async function showBuyerDashboard() {

    if (!currentUser) {

        showLoginModal();

        return;
    }

    showSection("buyerDashboardSection");

    await loadBuyerDashboard();
}


async function loadBuyerDashboard() {

    try {

        const [
            ordersData,
            wishlistData,
            comparisonData
        ] = await Promise.all([

            apiRequest("/orders/my"),

            apiRequest("/wishlist"),

            apiRequest("/comparison")
        ]);


        // /orders/my returns the orders array directly
        const orders =
            Array.isArray(ordersData)
                ? ordersData
                : (ordersData.orders || []);


        const wishlistCount =
            wishlistData.count || 0;


        const comparisonCount =
            comparisonData.count || 0;


        document.getElementById(
            "buyerOrderCount"
        ).textContent =
            orders.length;


        document.getElementById(
            "buyerWishlistCount"
        ).textContent =
            wishlistCount;


        document.getElementById(
            "buyerCompareCount"
        ).textContent =
            comparisonCount;


        renderBuyerRecentOrders(
            orders.slice(0, 5)
        );


    } catch (error) {

        console.error(
            "Buyer dashboard error:",
            error
        );

        showToast(
            error.message || "Unable to load buyer dashboard.",
            "danger"
        );
    }
}


function renderBuyerRecentOrders(orders) {

    const container =
        document.getElementById(
            "buyerRecentOrders"
        );


    if (!orders.length) {

        container.innerHTML = `

            <div class="text-center py-4">

                <i
                    class="bi bi-cart-x fs-1 text-muted"
                ></i>

                <p class="text-muted mt-2">
                    You don't have any orders yet.
                </p>

                <button
                    class="btn btn-dark"
                    onclick="showMarketplace()"
                >
                    Start Shopping
                </button>

            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="table-responsive">

            <table class="table align-middle">

                <thead>

                    <tr>

                        <th>
                            Order
                        </th>

                        <th>
                            Date
                        </th>

                        <th>
                            Items
                        </th>

                        <th>
                            Total
                        </th>

                        <th>
                            Status
                        </th>

                        <th>
                            Payment
                        </th>

                        <th>
                            Action
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        orders.map(order => `

                            <tr>

                                <td>
                                    <strong>
                                        #${order.id}
                                    </strong>
                                </td>

                                <td>
                                    ${new Date(
                                        order.created_at
                                    ).toLocaleDateString()}
                                </td>

                                <td>
                                    ${order.item_count || 0}
                                </td>

                                <td>
                                    ${formatMoney(
                                        order.total_amount
                                    )}
                                </td>

                                <td>
                                    <span class="badge bg-secondary">
                                        ${escapeHtml(
                                            order.order_status
                                        )}
                                    </span>
                                </td>

                                <td>
                                    <span class="badge bg-info">
                                        ${escapeHtml(
                                            order.payment_status
                                        )}
                                    </span>
                                </td>

                                <td>

                                    <button
                                        class="btn btn-sm btn-dark"
                                        onclick="showOrderDetails(${order.id})"
                                    >
                                        View
                                    </button>

                                </td>

                            </tr>

                        `).join("")
                    }

                </tbody>

            </table>

        </div>
    `;
}

async function showOrderDetails(orderId) {

    showSection("ordersSection");


    const container =
        document.getElementById(
            "ordersList"
        );


    container.innerHTML = `
        <div class="text-center py-5">

            <div class="spinner-border"></div>

            <p class="text-muted mt-3">
                Loading order...
            </p>

        </div>
    `;


    try {

        const data =
            await apiRequest(
                `/orders/${orderId}`
            );


        const order =
            data.order;

        const items =
            data.items || [];


        container.innerHTML = `

            <button
                class="btn btn-outline-secondary mb-4"
                onclick="showBuyerDashboard()"
            >
                <i class="bi bi-arrow-left"></i>
                Back to Dashboard
            </button>


            <div class="card shadow-sm mb-4">

                <div class="card-body">

                    <div class="row g-3">

                        <div class="col-md-3">

                            <small class="text-muted">
                                Order
                            </small>

                            <h5>
                                #${order.id}
                            </h5>

                        </div>


                        <div class="col-md-3">

                            <small class="text-muted">
                                Order Status
                            </small>

                            <h5>
                                <span class="badge bg-secondary">
                                    ${escapeHtml(
                                        order.order_status
                                    )}
                                </span>
                            </h5>

                        </div>


                        <div class="col-md-3">

                            <small class="text-muted">
                                Payment
                            </small>

                            <h5>
                                <span class="badge bg-info">
                                    ${escapeHtml(
                                        order.payment_status
                                    )}
                                </span>
                            </h5>

                        </div>


                        <div class="col-md-3">

                            <small class="text-muted">
                                Total
                            </small>

                            <h5>
                                ${formatMoney(
                                    order.total_amount
                                )}
                            </h5>

                        </div>

                    </div>

                </div>

            </div>


            <div class="card shadow-sm">

                <div class="card-header fw-bold">
                    Order Items
                </div>


                <div class="card-body">

                    ${
                        items.map(item => `

                            <div
                                class="row align-items-center border-bottom py-3"
                            >

                                <div class="col-md-2">

                                    ${
                                        item.image_url
                                        ?
                                        `<img
                                            src="${escapeHtml(
                                                item.image_url
                                            )}"
                                            class="img-fluid rounded"
                                            style="height:80px;width:80px;object-fit:cover;"
                                        >`
                                        :
                                        `<i class="bi bi-box fs-1 text-muted"></i>`
                                    }

                                </div>


                                <div class="col-md-4">

                                    <h6>
                                        ${escapeHtml(
                                            item.product_name
                                        )}
                                    </h6>

                                    <small class="text-muted">
                                        Seller:
                                        ${escapeHtml(
                                            item.seller_name
                                        )}
                                    </small>

                                </div>


                                <div class="col-md-2">

                                    Quantity:
                                    ${item.quantity}

                                </div>

                                ${order.order_status === "delivered"
                                    ? `
                                        <button
                                            class="btn btn-sm btn-outline-dark mt-2"
                                            onclick="openReviewModal(
                                                ${item.product_id},
                                                '${escapeHtml(item.name).replace(/'/g, "\\'")}'
                                            )"
                                        >
                                            <i class="bi bi-star me-1"></i>
                                            Write Review
                                        </button>
                                    `
                                    : ""
                                }


                                <div class="col-md-2">

                                    ${formatMoney(
                                        item.price
                                    )}

                                </div>


                                <div class="col-md-2 fw-bold">

                                    ${formatMoney(
                                        item.subtotal
                                    )}

                                </div>

                            </div>

                        `).join("")
                    }

                </div>

            </div>
        `;


    } catch (error) {

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}

async function startRazorpayPayment(orderId) {
  if (!currentUser) {
    showToast("Please login first", "warning");
    return;
  }

  try {
    showToast("Preparing secure payment...");

    const paymentOrder = await apiRequest(
      `/payments/create/${orderId}`,
      {
        method: "POST",
      }
    );

    const options = {
      key: paymentOrder.keyId,

      amount: paymentOrder.amount,

      currency: paymentOrder.currency,

      name: "ReCampus",

      description: `Payment for Order #${paymentOrder.orderId}`,

      order_id: paymentOrder.razorpayOrderId,

      prefill: {
        name: currentUser.name || "",
        email: currentUser.email || "",
        contact: currentUser.mobile || "",
      },

      theme: {
        color: "#0d6efd",
      },

      handler: async function (response) {
        try {
          showToast("Verifying payment...");

          const verification = await apiRequest(
            "/payments/verify",
            {
              method: "POST",

              body: JSON.stringify({
                razorpay_order_id:
                  response.razorpay_order_id,

                razorpay_payment_id:
                  response.razorpay_payment_id,

                razorpay_signature:
                  response.razorpay_signature,
              }),
            }
          );

          showToast(
            "Payment successful! Order confirmed."
          );

          setTimeout(() => {
            showBuyerDashboard();
          }, 1000);
        } catch (error) {
          console.error(
            "Payment verification error:",
            error
          );

          showToast(
            error.message ||
              "Payment verification failed",
            "danger"
          );
        }
      },

      modal: {
        ondismiss: function () {
          showToast(
            "Payment window closed",
            "warning"
          );
        },
      },
    };

    const razorpay = new Razorpay(options);

    razorpay.on(
      "payment.failed",
      async function (response) {
        console.error(
          "Razorpay payment failed:",
          response
        );

        try {
          await apiRequest(
            "/payments/failed",
            {
              method: "POST",

              body: JSON.stringify({
                razorpay_order_id:
                  response.error?.metadata?.order_id,

                razorpay_payment_id:
                  response.error?.metadata?.payment_id,
              }),
            }
          );
        } catch (error) {
          console.error(
            "Failed payment handling error:",
            error
          );
        }

        showToast(
          "Payment failed. You can try again.",
          "danger"
        );
      }
    );

    razorpay.open();
  } catch (error) {
    console.error(
      "Razorpay initialization error:",
      error
    );

    showToast(
      error.message ||
        "Unable to start payment",
      "danger"
    );
  }
}

async function loadSellerOrders() {

    const container =
        document.getElementById(
            "sellerOrders"
        );


    if (!container) {
        console.error(
            "sellerOrders container not found."
        );

        return;
    }


    container.innerHTML = `
        <div class="text-center py-4">

            <div class="spinner-border"></div>

            <p class="text-muted mt-2">
                Loading orders...
            </p>

        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/orders/seller/orders"
            );


        const orders =
            Array.isArray(data)
                ? data
                : (
                    data.orders ||
                    []
                );


        if (!orders.length) {

            container.innerHTML = `
                <div class="empty-state">

                    <i class="bi bi-cart-check"></i>

                    <h5>
                        No orders yet.
                    </h5>

                    <p class="text-muted">
                        Orders for your products will appear here.
                    </p>

                </div>
            `;

            return;
        }


        container.innerHTML = `

            <div class="table-responsive">

                <table class="table align-middle">

                    <thead>

                        <tr>

                            <th>
                                Order
                            </th>

                            <th>
                                Buyer
                            </th>

                            <th>
                                Product
                            </th>

                            <th>
                                Qty
                            </th>

                            <th>
                                Amount
                            </th>

                            <th>
                                Payment
                            </th>

                            <th>
                                Status
                            </th>

                            <th>
                                Action
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            orders.map(order => `

                                <tr>

                                    <td>

                                        <strong>
                                            #${order.id}
                                        </strong>

                                        <br>

                                        <small class="text-muted">
                                            ${new Date(
                                                order.created_at
                                            ).toLocaleDateString()}
                                        </small>

                                    </td>


                                    <td>

                                        <strong>
                                            ${escapeHtml(
                                                order.buyer_name ||
                                                "Buyer"
                                            )}
                                        </strong>

                                        <br>

                                        <small class="text-muted">
                                            ${escapeHtml(
                                                order.buyer_email ||
                                                ""
                                            )}
                                        </small>

                                    </td>


                                    <td>

                                        ${escapeHtml(
                                            order.product_name ||
                                            "Product"
                                        )}

                                    </td>


                                    <td>
                                        ${Number(
                                            order.quantity || 0
                                        )}
                                    </td>


                                    <td>
                                        ${formatMoney(
                                            order.subtotal ||
                                            order.total_amount ||
                                            0
                                        )}
                                    </td>


                                    <td>

                                        <span class="badge bg-info">

                                            ${escapeHtml(
                                                order.payment_status ||
                                                "pending"
                                            )}

                                        </span>

                                    </td>


                                    <td>

                                        <span class="badge bg-secondary">

                                            ${escapeHtml(
                                                order.order_status ||
                                                "placed"
                                            )}

                                        </span>

                                    </td>


                                    <td>

                                        ${
                                            order.payment_status === "paid"
                                            &&
                                            ![
                                                "delivered",
                                                "cancelled",
                                                "returned"
                                            ].includes(
                                                order.order_status
                                            )
                                            ?

                                            `
                                                <select
                                                    class="form-select form-select-sm"
                                                    onchange="
                                                        updateSellerOrderStatus(
                                                            ${order.id},
                                                            this.value
                                                        )
                                                    "
                                                >

                                                    <option
                                                        value="confirmed"
                                                        ${
                                                            order.order_status ===
                                                            "confirmed"
                                                            ?
                                                            "selected"
                                                            :
                                                            ""
                                                        }
                                                    >
                                                        Confirmed
                                                    </option>


                                                    <option
                                                        value="processing"
                                                        ${
                                                            order.order_status ===
                                                            "processing"
                                                            ?
                                                            "selected"
                                                            :
                                                            ""
                                                        }
                                                    >
                                                        Processing
                                                    </option>


                                                    <option
                                                        value="shipped"
                                                        ${
                                                            order.order_status ===
                                                            "shipped"
                                                            ?
                                                            "selected"
                                                            :
                                                            ""
                                                        }
                                                    >
                                                        Shipped
                                                    </option>


                                                    <option
                                                        value="delivered"
                                                        ${
                                                            order.order_status ===
                                                            "delivered"
                                                            ?
                                                            "selected"
                                                            :
                                                            ""
                                                        }
                                                    >
                                                        Delivered
                                                    </option>

                                                </select>
                                            `

                                            :

                                            `
                                                <span class="text-muted small">
                                                    ${
                                                        order.order_status ===
                                                        "delivered"
                                                        ?
                                                        "Completed"
                                                        :
                                                        "Payment required"
                                                    }
                                                </span>
                                            `
                                        }

                                    </td>

                                </tr>

                            `).join("")
                        }

                    </tbody>

                </table>

            </div>

        `;
    

    } catch (error) {

        console.error(
            "Seller orders error:",
            error
        );


        container.innerHTML = `

            <div class="alert alert-danger">

                ${escapeHtml(
                    error.message ||
                    "Unable to load seller orders."
                )}

            </div>

        `;
    }
}


async function updateSellerOrderStatus(
    orderId,
    status
) {

    if (!orderId || !status) {

        return;
    }


    try {

        const data =
            await apiRequest(
                `/orders/seller/${orderId}/status`,
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        status
                    })
                }
            );


        showToast(
            data.message ||
            "Order status updated successfully.",
            "success"
        );


        await loadSellerOrders();


    } catch (error) {

        console.error(
            "Update seller order status error:",
            error
        );


        showToast(
            error.message ||
            "Unable to update order status.",
            "danger"
        );


        await loadSellerOrders();
    }
}

// ============================================================
// REVIEWS & RATINGS
// ============================================================

let selectedReviewRating = 0;


/*
============================================================
OPEN REVIEW MODAL
============================================================
*/

function openReviewModal(productId, productName) {

    const numericProductId = Number(productId);

    if (
        !Number.isInteger(numericProductId) ||
        numericProductId <= 0
    ) {
        showToast(
            "Invalid product.",
            "danger"
        );

        return;
    }


    selectedReviewRating = 0;


    document.getElementById(
        "reviewProductId"
    ).value = numericProductId;


    document.getElementById(
        "reviewProductName"
    ).textContent =
        productName || "Product";


    document.getElementById(
        "reviewComment"
    ).value = "";


    document.getElementById(
        "reviewRatingText"
    ).textContent =
        "Select a rating";


    resetReviewStars();


    const modalElement =
        document.getElementById(
            "reviewModal"
        );


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    modal.show();
}


/*
============================================================
SELECT RATING
============================================================
*/

function selectReviewRating(rating) {

    const numericRating = Number(rating);


    if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
    ) {
        return;
    }


    selectedReviewRating =
        numericRating;


    const ratingLabels = {
        1: "Very Poor",
        2: "Poor",
        3: "Average",
        4: "Good",
        5: "Excellent"
    };


    document.getElementById(
        "reviewRatingText"
    ).textContent =
        `${numericRating} / 5 - ${ratingLabels[numericRating]}`;


    const stars =
        document.querySelectorAll(
            ".review-star"
        );


    stars.forEach(star => {

        const starRating =
            Number(
                star.dataset.rating
            );


        const icon =
            star.querySelector("i");


        if (
            starRating <=
            numericRating
        ) {

            icon.className =
                "bi bi-star-fill";

            star.classList.remove(
                "btn-outline-warning"
            );

            star.classList.add(
                "btn-warning"
            );

        } else {

            icon.className =
                "bi bi-star";

            star.classList.remove(
                "btn-warning"
            );

            star.classList.add(
                "btn-outline-warning"
            );
        }

    });
}


/*
============================================================
RESET STARS
============================================================
*/

function resetReviewStars() {

    document
        .querySelectorAll(
            ".review-star"
        )
        .forEach(star => {

            const icon =
                star.querySelector("i");


            icon.className =
                "bi bi-star";


            star.classList.remove(
                "btn-warning"
            );


            star.classList.add(
                "btn-outline-warning"
            );

        });
}


/*
============================================================
SUBMIT REVIEW
============================================================
*/

async function submitReview() {

    try {

        const productId =
            Number(
                document.getElementById(
                    "reviewProductId"
                ).value
            );


        const comment =
            document.getElementById(
                "reviewComment"
            ).value.trim();


        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            showToast(
                "Invalid product.",
                "danger"
            );

            return;
        }


        if (
            selectedReviewRating < 1 ||
            selectedReviewRating > 5
        ) {

            showToast(
                "Please select a rating.",
                "warning"
            );

            return;
        }


        const button =
            document.querySelector(
                "#reviewModal .modal-footer .btn-dark"
            );


        button.disabled = true;

        button.innerHTML =
            `
            <span
                class="spinner-border spinner-border-sm me-1"
            ></span>
            Submitting...
            `;


        const data =
            await apiRequest(
                "/reviews",
                {
                    method: "POST",

                    body: JSON.stringify({
                        product_id:
                            productId,

                        rating:
                            selectedReviewRating,

                        comment:
                            comment || null
                    })
                }
            );


        showToast(
            data.message ||
            "Review submitted successfully.",
            "success"
        );


        const modalElement =
            document.getElementById(
                "reviewModal"
            );


        const modal =
            bootstrap.Modal.getInstance(
                modalElement
            );


        if (modal) {
            modal.hide();
        }


        selectedReviewRating = 0;


    } catch (error) {

        console.error(
            "Submit review error:",
            error
        );


        showToast(
            error.message ||
            "Unable to submit review.",
            "danger"
        );


    } finally {

        const button =
            document.querySelector(
                "#reviewModal .modal-footer .btn-dark"
            );


        if (button) {

            button.disabled = false;

            button.innerHTML =
                `
                <i class="bi bi-send me-1"></i>
                Submit Review
                `;
        }
    }
}

// =====================================================
// OPEN CONTACT SELLER MODAL
// =====================================================

function openMessageSellerModal(
    sellerId,
    productId,
    productName
) {

    const numericSellerId =
        Number(sellerId);

    const numericProductId =
        Number(productId);


    if (
        !Number.isInteger(numericSellerId) ||
        numericSellerId <= 0
    ) {

        showToast(
            "Seller information is unavailable.",
            "danger"
        );

        return;
    }


    if (
        !Number.isInteger(numericProductId) ||
        numericProductId <= 0
    ) {

        showToast(
            "Invalid product.",
            "danger"
        );

        return;
    }


    document.getElementById(
        "messageSellerId"
    ).value = numericSellerId;


    document.getElementById(
        "messageProductId"
    ).value = numericProductId;


    document.getElementById(
        "messageProductName"
    ).textContent =
        productName || "Product";


    document.getElementById(
        "sellerMessage"
    ).value = "";


    const modalElement =
        document.getElementById(
            "messageSellerModal"
        );


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    modal.show();

}


// =====================================================
// SEND MESSAGE TO SELLER
// =====================================================

async function sendSellerMessage() {

    try {

        const sellerId =
            Number(
                document.getElementById(
                    "messageSellerId"
                ).value
            );


        const productId =
            Number(
                document.getElementById(
                    "messageProductId"
                ).value
            );


        const message =
            document.getElementById(
                "sellerMessage"
            ).value.trim();


        if (
            !Number.isInteger(sellerId) ||
            sellerId <= 0
        ) {

            showToast(
                "Invalid seller.",
                "danger"
            );

            return;
        }


        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            showToast(
                "Invalid product.",
                "danger"
            );

            return;
        }


        if (!message) {

            showToast(
                "Please enter a message.",
                "warning"
            );

            return;
        }


        if (message.length > 2000) {

            showToast(
                "Message cannot exceed 2000 characters.",
                "warning"
            );

            return;
        }


        const button =
            document.querySelector(
                "#messageSellerModal .modal-footer .btn-dark"
            );


        button.disabled = true;

        button.innerHTML = `
            <span
                class="spinner-border spinner-border-sm me-1"
            ></span>
            Sending...
        `;


        const data =
            await apiRequest(
                "/messages",
                {
                    method: "POST",

                    body: JSON.stringify({
                        receiver_id: sellerId,
                        product_id: productId,
                        message: message
                    })
                }
            );


        showToast(
            data.message ||
            "Message sent successfully.",
            "success"
        );


        const modalElement =
            document.getElementById(
                "messageSellerModal"
            );


        const modal =
            bootstrap.Modal.getInstance(
                modalElement
            );


        if (modal) {
            modal.hide();
        }


    } catch (error) {

        console.error(
            "Send seller message error:",
            error
        );


        showToast(
            error.message ||
            "Unable to send message.",
            "danger"
        );


    } finally {

        const button =
            document.querySelector(
                "#messageSellerModal .modal-footer .btn-dark"
            );


        if (button) {

            button.disabled = false;

            button.innerHTML = `
                <i class="bi bi-send me-1"></i>
                Send Message
            `;

        }

    }

}

let activeChatUserId = null;
let activeChatProductId = null;
let activeChatUserName = "";


// =====================================================
// SHOW MESSAGES
// =====================================================

async function showMessages() {

    if (!currentUser) {
        showLoginModal();
        return;
    }

    showSection("messagesSection");

    await loadConversations();
}


// =====================================================
// LOAD CONVERSATIONS
// =====================================================

async function loadConversations() {

    const container =
        document.getElementById("conversationsList");

    container.innerHTML = `
        <div class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2"></div>
            Loading conversations...
        </div>
    `;

    try {

        const conversations =
            await apiRequest(
                "/messages/conversations"
            );

        if (!conversations.length) {

            container.innerHTML = `
                <div class="text-center text-muted py-5 px-3">

                    <i class="bi bi-chat fs-2"></i>

                    <p class="mt-2 mb-0">
                        No conversations yet.
                    </p>

                </div>
            `;

            return;
        }


        container.innerHTML =
            conversations.map(conversation => {

                const unread =
                    Number(
                        conversation.unread_count || 0
                    );


                return `

                    <button
                        type="button"
                        class="list-group-item list-group-item-action text-start"
                        onclick="openConversation(
                            ${conversation.other_user_id},
                            '${escapeHtml(
                                conversation.other_user_name ||
                                "User"
                            ).replace(/'/g, "\\'")}',
                            ${
                                conversation.product_id
                                    ? conversation.product_id
                                    : "null"
                            }
                        )"
                    >

                        <div
                            class="d-flex justify-content-between"
                        >

                            <strong>
                                ${escapeHtml(
                                    conversation.other_user_name ||
                                    "User"
                                )}
                            </strong>

                            ${
                                unread > 0
                                    ?
                                    `<span class="badge bg-danger">
                                        ${unread}
                                    </span>`
                                    :
                                    ""
                            }

                        </div>


                        ${
                            conversation.product_name
                                ?
                                `<small class="text-muted">
                                    ${escapeHtml(
                                        conversation.product_name
                                    )}
                                </small>`
                                :
                                ""
                        }


                        <div
                            class="small text-muted text-truncate mt-1"
                        >
                            ${escapeHtml(
                                conversation.latest_message ||
                                ""
                            )}
                        </div>

                    </button>

                `;

            }).join("");


    } catch (error) {

        console.error(
            "Load conversations error:",
            error
        );

        container.innerHTML = `
            <div class="alert alert-danger m-3">
                ${escapeHtml(error.message)}
            </div>
        `;

    }
}


// =====================================================
// OPEN CONVERSATION
// =====================================================

async function openConversation(
    userId,
    userName,
    productId = null
) {

    activeChatUserId =
        Number(userId);

    activeChatUserName =
        userName || "User";

    activeChatProductId =
        productId
            ? Number(productId)
            : null;


    document.getElementById(
        "chatHeader"
    ).innerHTML = `

        <i class="bi bi-person-circle me-2"></i>

        ${escapeHtml(activeChatUserName)}

    `;


    document.getElementById(
        "chatMessageInput"
    ).disabled = false;


    document.getElementById(
        "sendChatMessageButton"
    ).disabled = false;


    await loadConversation();


    await markConversationRead();

}


// =====================================================
// LOAD CONVERSATION
// =====================================================

async function loadConversation() {

    const container =
        document.getElementById(
            "chatMessages"
        );


    container.innerHTML = `
        <div class="text-center text-muted py-5">

            <div class="spinner-border spinner-border-sm"></div>

            Loading messages...

        </div>
    `;


    try {

        const messages =
            await apiRequest(
                `/messages/${activeChatUserId}`
            );


        if (!messages.length) {

            container.innerHTML = `
                <div class="text-center text-muted py-5">

                    <i class="bi bi-chat-square-text fs-2"></i>

                    <p class="mt-2">
                        No messages yet.
                    </p>

                </div>
            `;

            return;
        }


        container.innerHTML =
            messages.map(message => {

                const mine =
                    Number(message.sender_id) ===
                    Number(currentUser.id);


                return `

                    <div
                        class="d-flex mb-3
                        ${
                            mine
                                ? "justify-content-end"
                                : "justify-content-start"
                        }"
                    >

                        <div
                            class="p-3 rounded"
                            style="
                                max-width:75%;
                                ${
                                    mine
                                        ? "background:#212529;color:white;"
                                        : "background:#f1f3f5;"
                                }
                            "
                        >

                            <div>
                                ${escapeHtml(
                                    message.message
                                )}
                            </div>


                            <small
                                class="${
                                    mine
                                        ? "text-white-50"
                                        : "text-muted"
                                }"
                            >

                                ${new Date(
                                    message.created_at
                                ).toLocaleString()}

                            </small>

                        </div>

                    </div>

                `;

            }).join("");


        container.scrollTop =
            container.scrollHeight;


    } catch (error) {

        console.error(
            "Load conversation error:",
            error
        );

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHtml(error.message)}
            </div>
        `;

    }
}


// =====================================================
// SEND CHAT MESSAGE
// =====================================================

async function sendChatMessage() {

    if (!activeChatUserId) {
        return;
    }


    const input =
        document.getElementById(
            "chatMessageInput"
        );


    const message =
        input.value.trim();


    if (!message) {
        return;
    }


    const button =
        document.getElementById(
            "sendChatMessageButton"
        );


    input.disabled = true;
    button.disabled = true;


    try {

        await apiRequest(
            "/messages",
            {
                method: "POST",

                body: JSON.stringify({

                    receiver_id:
                        activeChatUserId,

                    product_id:
                        activeChatProductId,

                    message:
                        message

                })
            }
        );


        input.value = "";


        await loadConversation();

        await loadConversations();


    } catch (error) {

        console.error(
            "Send chat message error:",
            error
        );

        showToast(
            error.message ||
            "Unable to send message.",
            "danger"
        );


    } finally {

        input.disabled = false;
        button.disabled = false;

        input.focus();

    }

}


// =====================================================
// MARK CONVERSATION AS READ
// =====================================================

async function markConversationRead() {

    if (!activeChatUserId) {
        return;
    }


    try {

        await apiRequest(
            `/messages/${activeChatUserId}/read`,
            {
                method: "PATCH"
            }
        );


        await loadConversations();


    } catch (error) {

        console.error(
            "Mark conversation read error:",
            error
        );

    }

}

function toggleBusinessFields() {

    const accountType =
        document.getElementById("registerAccountType").value;

    const businessFields =
        document.getElementById("businessRegistrationFields");

    const businessName =
        document.getElementById("registerBusinessName");

    const ownerName =
        document.getElementById("registerOwnerName");

    if (accountType === "business") {

        businessFields.classList.remove("d-none");

        businessName.required = true;
        ownerName.required = true;

    } else {

        businessFields.classList.add("d-none");

        businessName.required = false;
        ownerName.required = false;

        businessName.value = "";
        ownerName.value = "";
    }
}

initializeApp();