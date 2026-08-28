import { prisma } from "@/lib/db";

export async function listContactRequests() {
  return prisma.contactRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
