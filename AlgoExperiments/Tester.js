import fs from "fs";
import { search } from "./KMP.js";
import { naiveSubstringSearch } from "./NaiveSearch.js";
import { boyerMooreSearch } from "./BoyerMoore.js";
import { performance } from "perf_hooks";  // In Node.js, use perf_hooks

// Generate a random lowercase string of length n
function generateRandomString(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function measureSearchTime(searchFn, text, pattern) {
  const startTime = performance.now();
  // The match positions are not needed for timing, but we do the search to be accurate
  searchFn(text, pattern);
  const endTime = performance.now();
  return endTime - startTime; // Duration in ms
}

const pattern = "aba";
const inputSizes = [1000, 5000, 10000, 20000, 50000, 100000, 1000000, 10000000];

// Create a header row
let csvOutput = "size,naiveTime(ms),boyerMooreTime(ms),kmpTime(ms)\n";

for (const size of inputSizes) {
  const text = generateRandomString(size);
  
  const naiveTime = measureSearchTime(naiveSubstringSearch, text, pattern);
  const bmTime    = measureSearchTime(boyerMooreSearch, text, pattern);
  const kmpTime   = measureSearchTime(search, pattern, text);

  csvOutput += `${size},${naiveTime.toFixed(3)},${bmTime.toFixed(3)},${kmpTime.toFixed(3)}\n`;
}

// Write the entire CSV string to file
fs.writeFileSync("results.csv", csvOutput, "utf8");

console.log("Benchmark complete! CSV saved to results.csv.");
