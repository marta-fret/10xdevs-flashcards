import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const createErrorLogger = (ownerName: string) => (message: string) => {
  // eslint-disable-next-line no-console
  console.error(`${ownerName}: ${message}`);
};
