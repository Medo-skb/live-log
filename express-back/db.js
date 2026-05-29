const oracledb = require('oracledb');
require("dotenv").config();

const dbConfig = {
    user: process.env.db_user,
    password: process.env.db_pwd,
    connectString: process.env.db_address,
    poolMin: 1,
    poolMax: 100,
    poolIncrement: 1
};

let pool;

async function init() {
    if (!pool) {
        pool = await oracledb.createPool(dbConfig);
        console.log("✅ Oracle connection pool created");
    }
}

function getConnection() {
    if (!pool) {
        throw new Error("Connection pool not initialized. Call init() first.");
    }
    return pool.getConnection();
}

module.exports = {
    init,
    getConnection
};
