require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
    charset: "utf8mb4"
  });
  for (const file of ["schema.sql", "seed.sql"]) {
    await connection.query(fs.readFileSync(path.join(__dirname, file), "utf8"));
    console.log(`${file} executado.`);
  }
  await connection.end();
  console.log("Banco pronto.");
})().catch((error) => { console.error("Erro ao preparar o banco:", error.message); process.exit(1); });
