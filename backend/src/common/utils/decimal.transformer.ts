import { ValueTransformer } from 'typeorm';

/**
 * node-postgres returns NUMERIC columns as strings to avoid precision loss.
 * Money values are stored as NUMERIC(14,2) and exposed to the app as numbers
 * (2 d.p. fits comfortably inside a double for the amounts we handle).
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};
