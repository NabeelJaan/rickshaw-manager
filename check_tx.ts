import db from "./server/database";
console.log("Total transactions:", db.prepare("SELECT COUNT(*) as count FROM transactions").get());
console.log("Sample:", db.prepare("SELECT * FROM transactions LIMIT 5").all());
