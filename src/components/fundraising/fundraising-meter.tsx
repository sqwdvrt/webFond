import Link from "next/link";

import {
  formatFundraisingAmount,
  type FundraisingProgress,
} from "@/features/fundraising/progress";

export function FundraisingMeter({
  helpHref,
  progress,
}: {
  helpHref: string;
  progress: FundraisingProgress;
}) {
  const collected = formatFundraisingAmount(progress.collectedKopecks);
  const goal = formatFundraisingAmount(progress.goalKopecks);
  const label = `Собрано ${collected} из ${goal}`;

  return (
    <div className="fundraising-meter">
      <div className="fundraising-meter-amounts">
        <div>
          <span className="fundraising-meter-label">собрали</span>
          <strong>{collected}</strong>
        </div>
        <div className="fundraising-meter-goal">
          <span className="fundraising-meter-label">нужно</span>
          <strong>{goal}</strong>
        </div>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress.fillPercent)}
        className="fundraising-meter-track"
        role="progressbar"
      >
        <div
          className="fundraising-meter-fill"
          style={{ width: `${progress.fillPercent}%` }}
        />
      </div>
      <Link className="button button-primary" href={helpHref}>
        Помочь
      </Link>
    </div>
  );
}
