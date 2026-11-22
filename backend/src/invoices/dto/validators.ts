import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isIsoCalendarDate } from '../../common/utils/date';

/** Strict YYYY-MM-DD that is also a real calendar date. */
export function IsIsoDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isIsoDate',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a valid date (YYYY-MM-DD)`, ...options },
      validator: { validate: (value: unknown) => isIsoCalendarDate(value) },
    });
}

/**
 * Cross-field rule: this date must be on or after `otherProperty`.
 * Skips when either side is not a valid date — that is reported by IsIsoDate,
 * so the client gets one precise message instead of two confusing ones.
 */
export function IsOnOrAfter(otherProperty: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isOnOrAfter',
      target: object.constructor,
      propertyName,
      constraints: [otherProperty],
      options: { message: `${propertyName} must be on or after ${otherProperty}`, ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[args.constraints[0]];
          if (!isIsoCalendarDate(value) || !isIsoCalendarDate(other)) return true;
          return value >= other;
        },
      },
    });
}
