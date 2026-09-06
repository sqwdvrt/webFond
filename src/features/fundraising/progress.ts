export type FundraisingProgress = {
  collectedKopecks: number;
  goalKopecks: number;
  fillPercent: number;
};

export function fundraisingProgress(input: {
  goalAmountKopecks: number | null;
  onlineSucceededKopecks: number;
  manualRaisedKopecks: number;
}): FundraisingProgress | null {
  const { goalAmountKopecks, onlineSucceededKopecks, manualRaisedKopecks } =
    input;

  if (goalAmountKopecks == null || goalAmountKopecks <= 0) {
    return null;
  }

  const collectedKopecks = onlineSucceededKopecks + manualRaisedKopecks;
  const fillPercent =
    collectedKopecks <= 0
      ? 0
      : Math.min(
          100,
          Math.round((collectedKopecks * 10_000) / goalAmountKopecks) / 100,
        );

  return {
    collectedKopecks,
    goalKopecks: goalAmountKopecks,
    fillPercent,
  };
}

const amountFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatFundraisingAmount(amountKopecks: number) {
  return amountFormatter.format(Math.trunc(amountKopecks / 100));
}
