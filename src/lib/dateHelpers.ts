export function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 6 = Saturday

  // In Egypt, week starts on Saturday.
  // If today is Saturday (6), start is today.
  // If today is Sunday (0), start is yesterday.
  // If today is Monday (1), start is 2 days ago.
  
  // Calculate days to subtract to get to the most recent Saturday
  const daysToSubtract = (dayOfWeek + 1) % 7; 
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysToSubtract);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Friday
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}
