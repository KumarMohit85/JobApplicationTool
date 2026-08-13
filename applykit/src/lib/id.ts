/** Simple unique id for list items (skills, experience, etc.). */
export function createId(): string {
  return crypto.randomUUID();
}
