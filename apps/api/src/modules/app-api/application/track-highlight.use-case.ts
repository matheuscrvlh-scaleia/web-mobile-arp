import type { Clock } from "../../../shared/application/ports/clock";
import { NotFoundError } from "../../../shared/domain/errors";
import type {
  HighlightInteraction,
  HighlightMetricsRecorder,
  LiveHighlights,
} from "../domain/repositories";

export interface TrackHighlightDeps {
  highlights: LiveHighlights;
  metrics: HighlightMetricsRecorder;
  clock: Clock;
}

/** Conta exibição/clique de um destaque no ar (métrica da mídia patrocinada). */
export class TrackHighlightUseCase {
  constructor(private readonly deps: TrackHighlightDeps) {}

  async execute(input: { highlightId: string; interaction: HighlightInteraction }): Promise<void> {
    const now = this.deps.clock.now();
    if (!(await this.deps.highlights.isLive(input.highlightId, now))) {
      throw new NotFoundError("Destaque não encontrado");
    }
    this.deps.metrics.record(input.highlightId, input.interaction, now);
  }
}
