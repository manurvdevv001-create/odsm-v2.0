import { db } from "./src/lib/db";
import fs from "fs";

async function main() {
  const school = await db.school.findFirst();
  if (school) {
    fs.writeFileSync("school.json", JSON.stringify({
      ...school,
      structure: JSON.parse(school.structure || "{}"),
      timetables: JSON.parse(school.timetables || "{}"),
      courses: JSON.parse(school.courses || "{}"),
    }, null, 2));
    console.log("school.json created");
  } else {
    console.log("No school found");
  }
}

main();
