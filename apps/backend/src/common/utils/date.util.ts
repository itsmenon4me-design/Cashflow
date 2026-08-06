export class DateHelper {
  static now(): Date {
    return new Date();
  }

  static nowIso(): string {
    return new Date().toISOString();
  }
}
