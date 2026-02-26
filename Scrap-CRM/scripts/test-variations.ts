
import { generateVariations } from "../server/utils/variations";

const testCases = [
    "574 Main Street, LLC",
    "John Smith",
    "Smith, John",
    "Estate of John Doe",
    "John & Jane Doe",
    "Mary-Anne Smith",
    "John Smith JR.",
    "Acme Corp",
    "The John Doe Trust"
];

console.log("Running Party Variation Tests...\n");

testCases.forEach(name => {
    console.log(`Original: "${name}"`);
    const vars = generateVariations(name);
    console.log("Variations:", vars);
    console.log("-".repeat(40));
});
