import argon2 from 'argon2';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const requiredPassword = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to seed local users.`);
  return value;
};

const main = async (): Promise<void> => {
  const users = [
    {
      email: 'operations@warehouse.local',
      displayName: 'Nimali Perera',
      role: UserRole.OPERATIONS,
      password: requiredPassword('DEMO_OPERATIONS_PASSWORD'),
    },
    {
      email: 'support@warehouse.local',
      displayName: 'Dilan Fernando',
      role: UserRole.SUPPORT_ENGINEER,
      password: requiredPassword('DEMO_SUPPORT_PASSWORD'),
    },
    {
      email: 'admin@warehouse.local',
      displayName: 'Anuki Jayasinghe',
      role: UserRole.ADMIN,
      password: requiredPassword('DEMO_ADMIN_PASSWORD'),
    },
  ];

  for (const user of users) {
    const passwordHash = await argon2.hash(user.password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: user.email },
      update: { displayName: user.displayName, role: user.role, passwordHash, active: true },
      create: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordHash,
      },
    });
  }

  const inventory = [
    { sku: 'PALLET-STD', onHand: 240 },
    { sku: 'CRATE-COLD', onHand: 75 },
    { sku: 'LABEL-THERMAL', onHand: 1200 },
    { sku: 'WRAP-HEAVY', onHand: 380 },
  ];

  for (const item of inventory) {
    await prisma.inventory.upsert({
      where: { sku: item.sku },
      update: { onHand: item.onHand },
      create: item,
    });
  }
};

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed.');
    process.exitCode = 1;
  });
