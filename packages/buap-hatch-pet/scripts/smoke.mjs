#!/usr/bin/env node
import { hatchPet } from "../dist/index.js";

if (typeof hatchPet !== "function") {
  throw new Error("hatchPet export is missing.");
}

if (process.env.BUAP_HATCH_PET_LIVE !== "1") {
  console.log("buap-hatch-pet smoke passed: wrapper imported. Set BUAP_HATCH_PET_LIVE=1 for live skill execution.");
  process.exit(0);
}

const concept = process.env.BUAP_HATCH_PET_CONCEPT || "a tiny teal robot helper with a warm screen face";
const name = process.env.BUAP_HATCH_PET_NAME || "Buddy Hatch Smoke";
const result = await hatchPet({ concept, name });
console.log(JSON.stringify(result, null, 2));
