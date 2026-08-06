import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

// Simple placeholder validators with reasonable defaults. Replace or extend
// with more rigorous checks as requirements tighten.

export function IsCurrency(validationOptions?: ValidationOptions) {
  return function (
    object: { constructor: new (...args: any[]) => unknown },
    propertyName: string,
  ) {
    registerDecorator({
      name: 'isCurrency',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          // ISO 4217 three-letter code e.g. USD, IDR
          return /^[A-Z]{3}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a 3-letter ISO currency code`;
        },
      },
    });
  };
}

export function IsPhoneNumberID(validationOptions?: ValidationOptions) {
  return function (
    object: { constructor: new (...args: any[]) => unknown },
    propertyName: string,
  ) {
    registerDecorator({
      name: 'isPhoneNumberID',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          // Accepts international (+) or numeric, 7-15 digits
          return /^\+?[0-9]{7,15}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid phone number`;
        },
      },
    });
  };
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (
    object: { constructor: new (...args: any[]) => unknown },
    propertyName: string,
  ) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          // Minimum 8 chars, at least one letter and one number
          return /(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be at least 8 characters long and contain letters and numbers`;
        },
      },
    });
  };
}

export function IsMoney(validationOptions?: ValidationOptions) {
  return function (
    object: { constructor: new (...args: any[]) => unknown },
    propertyName: string,
  ) {
    registerDecorator({
      name: 'isMoney',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value === 'number') return true;
          if (typeof value !== 'string') return false;
          // Accept numeric strings, optional decimals (2 dp recommended)
          return /^\d+(\.\d{1,2})?$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid monetary amount`;
        },
      },
    });
  };
}

export function IsTimezone(validationOptions?: ValidationOptions) {
  return function (
    object: { constructor: new (...args: any[]) => unknown },
    propertyName: string,
  ) {
    registerDecorator({
      name: 'isTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          // Basic check: contains a slash like 'Region/City' — placeholder
          return value.includes('/');
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid timezone identifier`;
        },
      },
    });
  };
}
