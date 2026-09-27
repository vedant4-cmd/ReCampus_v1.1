const express = require("express");
const { getColleges } = require("../controllers/collegeController");

const router = express.Router();

router.get("/", getColleges);

module.exports = router;