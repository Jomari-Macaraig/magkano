/** A PDF can't be read with certainty, so `extract` writes nothing. */
export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}
