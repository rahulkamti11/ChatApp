export async function getOrAllocateVirtualNumber(db: D1Database): Promise<string> {
  const available = await db.prepare(
    "SELECT phone_number FROM virtual_numbers WHERE status = 'available' AND phone_number NOT IN (SELECT virtual_number FROM users WHERE virtual_number IS NOT NULL) LIMIT 1"
  ).first<{ phone_number: string }>();

  if (available) {
    return available.phone_number;
  }

  const prefix = '+888';
  let newNumber = '';
  let isUnique = false;

  while (!isUnique) {
    const part1 = Math.floor(1000 + Math.random() * 9000);
    const part2 = Math.floor(1000 + Math.random() * 9000);
    newNumber = `${prefix}-${part1}-${part2}`;

    const existing = await db.prepare('SELECT id FROM users WHERE virtual_number = ?').bind(newNumber).first();
    if (!existing) {
      isUnique = true;
    }
  }

  await db.prepare("INSERT OR IGNORE INTO virtual_numbers (phone_number, status) VALUES (?, 'available')").bind(newNumber).run();
  return newNumber;
}
