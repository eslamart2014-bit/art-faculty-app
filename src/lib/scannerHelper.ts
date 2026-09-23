export const extractStudentCode = (decodedText: string): string => {
  if (!decodedText) return "";
  
  let code = decodedText.trim();
  
  // Try to match "كود الطالب: 12345" or "كود: 12345" or "الكود: 12345" or "Code: 12345"
  const match = decodedText.match(/(?:كود الطالب|الكود|كود|Code):\s*([^\n\r]+)/i);
  if (match && match[1]) {
    code = match[1].trim();
  } else {
    // If multiline without prefix, check if any line consists purely of digits
    const lines = decodedText.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d{1,6}$/.test(trimmed)) {
        code = trimmed;
        break;
      }
    }
  }
  
  // Pad with zeros if it's purely a short number
  if (/^\d+$/.test(code) && code.length < 4) {
    code = code.padStart(4, '0');
  }

  return code;
};
