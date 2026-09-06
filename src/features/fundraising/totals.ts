type DonationSumClient = {
  donation: {
    groupBy(args: {
      by: ["projectId"];
      where: {
        status: "SUCCEEDED";
        projectId: { in: string[] };
      };
      _sum: { amountKopecks: true };
    }): Promise<
      Array<{
        projectId: string | null;
        _sum: { amountKopecks: number | null };
      }>
    >;
  };
};

export async function sumSucceededDonationKopecksByProjectId(
  projectIds: string[],
  client: DonationSumClient,
): Promise<Map<string, number>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const rows = await client.donation.groupBy({
    by: ["projectId"],
    where: {
      status: "SUCCEEDED",
      projectId: { in: projectIds },
    },
    _sum: { amountKopecks: true },
  });

  return new Map(
    rows.flatMap((row) =>
      row.projectId
        ? [[row.projectId, row._sum.amountKopecks ?? 0] as const]
        : [],
    ),
  );
}
