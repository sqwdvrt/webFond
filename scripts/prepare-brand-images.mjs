import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Preserve the original. 104px serves the 52px header mark at 2× density.
const original = fileURLToPath(new URL("../public/brand/mark.jpg", import.meta.url));
const output = fileURLToPath(new URL("../public/brand/mark-small.webp", import.meta.url));
await sharp(original).rotate().resize(104, 104, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 90, effort: 6 }).toFile(output);
console.log(`Generated ${output}`);
