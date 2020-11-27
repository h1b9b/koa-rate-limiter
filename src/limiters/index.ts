export type Limit = {
  id: string,
  reset: number,
  total: number,
  remaining: number,
}

export interface LimiterOptions { id: string, max: number, duration: number, namespace: string, db: unknown }

export abstract class Limiter {
  protected id: string;
  protected key: string;
  protected max: number;
  protected duration: number;

  constructor(options: LimiterOptions) {
    this.id = options.id;
    this.max = options.max;
    this.duration = options.duration;
    this.key = `${options.namespace}:${this.id}`;
  }

  abstract get(): Promise<Limit>;
}