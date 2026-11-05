/** Base shape for every record stored in a persisted collection. */
export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** The editable part of an entity (what forms produce). */
export type EntityData<T extends Entity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
