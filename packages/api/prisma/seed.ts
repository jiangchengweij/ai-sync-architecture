import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      passwordHash,
      role: 'admin',
    },
  });

  // Create developer user
  const devHash = await bcrypt.hash('dev123', 10);
  const dev = await prisma.user.upsert({
    where: { email: 'dev@example.com' },
    update: {},
    create: {
      email: 'dev@example.com',
      name: 'Developer',
      passwordHash: devHash,
      role: 'developer',
    },
  });

  // Create a project group
  const group = await prisma.projectGroup.upsert({
    where: { name: 'Demo Project Group' },
    update: {},
    create: {
      name: 'Demo Project Group',
      description: 'Demo project group for development testing',
      syncStrategy: {
        mode: 'semi-automatic',
        confidenceThreshold: 0.85,
        autoMerge: false,
      },
    },
  });

  // Create base project
  const baseProject = await prisma.project.upsert({
    where: { gitUrl: 'https://github.com/org/base-project.git' },
    update: {},
    create: {
      projectGroupId: group.id,
      name: 'base-project',
      gitUrl: 'https://github.com/org/base-project.git',
      type: 'base',
    },
  });

  // Create variant projects
  const variant1 = await prisma.project.upsert({
    where: { gitUrl: 'https://github.com/org/client-alpha.git' },
    update: {},
    create: {
      projectGroupId: group.id,
      name: 'client-alpha',
      gitUrl: 'https://github.com/org/client-alpha.git',
      type: 'variant',
      metadata: { customizationNotes: 'Client Alpha customization' },
    },
  });

  const variant2 = await prisma.project.upsert({
    where: { gitUrl: 'https://github.com/org/client-beta.git' },
    update: {},
    create: {
      projectGroupId: group.id,
      name: 'client-beta',
      gitUrl: 'https://github.com/org/client-beta.git',
      type: 'variant',
      metadata: { customizationNotes: 'Client Beta customization' },
    },
  });

  console.log('Seed data created:', {
    users: [admin.email, dev.email],
    projectGroup: group.name,
    projects: [baseProject.name, variant1.name, variant2.name],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
