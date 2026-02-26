
import "dotenv/config";
import { db } from "../server/db";
import { uploads, scrapeItems } from "@shared/schema";
import { generateVariations } from "../server/utils/variations";

async function seed() {
  console.log("Seeding database with specific columns...");

  // clear existing data
  await db.delete(scrapeItems);
  await db.delete(uploads);

  const [result] = await db.insert(uploads).values({
    filename: "property_data.xlsx",
  });
  const uploadId = result.insertId;

  const rawItems = [
    {
      "File Number": "FN-1001",
      "State": "CA",
      "County": "Los Angeles",
      "Party Name 1": "John Smith",
      "Party Name 2": "Jane Smith",
      "Party Name 3": "",
      "Party Name 4": "",
      "Property Address": "123 Maple St",
      "Lot": "12",
      "Block": "A",
      "Townsnhip": "Central",
      "Prior Effective Date": "2023-01-01"
    },
    {
      "File Number": "FN-1002",
      "State": "NY",
      "County": "Kings",
      "Party Name 1": "Alice Brown",
      "Party Name 2": "",
      "Party Name 3": "",
      "Party Name 4": "",
      "Property Address": "456 Oak Ave",
      "Lot": "5",
      "Block": "7",
      "Townsnhip": "North",
      "Prior Effective Date": "2022-12-15"
    },
    {
      "File Number": "FN-1003",
      "State": "NJ",
      "County": "Middlesex",
      "Party Name 1": "574 Main Street, LLC",
      "Party Name 2": "",
      "Party Name 3": "",
      "Party Name 4": "",
      "Property Address": "574 Main Street",
      "Lot": "10",
      "Block": "22",
      "Townsnhip": "Woodbridge",
      "Prior Effective Date": "2023-05-20"
    }
  ];

  const items = rawItems.map(row => {
    const partyFields = [
      "Party Name 1",
      "Party Name 2",
      "Party Name 3",
      "Party Name 4"
    ] as const;

    const partyVariations: Record<string, string[]> = {};
    const partyCounts: Record<string, number> = {};

    partyFields.forEach(field => {
      const rawName = (row as any)[field];
      const nameStr = rawName ? String(rawName) : null;
      const vars = generateVariations(nameStr);

      partyVariations[field] = vars;
      partyCounts[field] = vars.length;
    });

    // Add to the row data like the upload route does
    (row as any).party_variations = partyVariations;
    (row as any).party_variation_count = partyCounts;

    return {
      uploadId: uploadId,
      data: row,
      status: "pending",
    };
  });

  await db.insert(scrapeItems).values(items as any);
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
