export const extractStudentCode = (decodedText: string): string => {
  if (!decodedText) return "";
  
  // Try to match the formatted string we generate in the student portal
  // Pattern: "كود الطالب: 12345"
  const match = decodedText.match(/كود الطالب:\s*([^\n]+)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Fallback to raw string
  return decodedText.trim();
};
