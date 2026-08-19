export const cleanDoctorName = (name: string): string => {
  if (!name) return "";

  return name
    .trim()

    // Removes:
    // Dr Ahmed Khan
    // Dr. Ahmed Khan
    // Dr . Ahmed Khan
    // DR. Ahmed Khan
    // Dr. Dr. Ahmed Khan
    .replace(/^(?:dr\b\s*\.?\s*)+/i, "")

    // Convert multiple spaces into one
    .replace(/\s+/g, " ")

    .trim();
};