import db from "./server/database";
console.log("Drivers:", db.prepare("SELECT * FROM drivers").all());
console.log("Rickshaws:", db.prepare("SELECT * FROM rickshaws").all());
console.log("Assignments:", db.prepare("SELECT * FROM rickshaw_assignments").all());
