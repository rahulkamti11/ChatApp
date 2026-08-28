export async function getOrAllocateVirtualNumber(db: D1Database): Promise<string> {
  const available = await db.prepare('SELECT phone_number FROM virtual_numbers WHERE status = "available" LIMIT 1').first<{ phone_number: string }>();
  
  if (available) {
    return available.phone_number;
  }
  
  const prefix = '+888';
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  const newNumber = prefix + '-' + part1 + '-' + part2;
  
  await db.prepare('INSERT OR IGNORE INTO virtual_numbers (phone_number, status) VALUES (?, "available")').bind(newNumber).run();
  return newNumber;
}
