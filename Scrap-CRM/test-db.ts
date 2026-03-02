import { storage } from "../server/storage";

async function run() {
    try {
        const stats = await storage.getUsersWithStats();
        console.log("Stats running OK:", stats.length);
    } catch (err) {
        console.error("DB error:", err);
    }
}
run();
