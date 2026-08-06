import { registerDecorator, ValidationOptions } from 'class-validator';

// Placeholder validator — enforces minimum length (12) per AUTHENTICATION-STANDARDS
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return value.length >= 12;
        },
        defaultMessage() {
          return 'Password is not strong enough (minimum 12 characters)';
        },
      },
    });
  };
}
