import { VIRTUAL_NUMBER_REGEX } from '../constants/virtual-number.js';

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

export function isValidVirtualNumber(number: string): boolean {
  return VIRTUAL_NUMBER_REGEX.test(number);
}
