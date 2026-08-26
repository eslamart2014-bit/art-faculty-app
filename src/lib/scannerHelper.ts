export const extractStudentCode = (decodedText: string): string => {
  if (!decodedText) return "";
  
  // Try to match the formatted string we generate in the student portal
  // Pattern: "كود الطالب: 12345"
  let code = decodedText.trim();
  const match = decodedText.match(/كود الطالب:\s*([^\n]+)/);
  if (match && match[1]) {
    code = match[1].trim();
  }
  
  // Pad with zeros if it's purely a short number
  if (/^\d+$/.test(code) && code.length < 4) {
    code = code.padStart(4, '0');
  }

  return code;
};
