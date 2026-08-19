// Luhn algorithm — the real checksum algorithm card numbers follow
export const isValidLuhn = (cardNumber: string): boolean => {
  const digitsOnly = cardNumber.replace(/\D/g, '');

  if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = parseInt(digitsOnly[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

export const isCardExpired = (expiryMonth: number, expiryYear: number): boolean => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

  if (expiryYear < currentYear) return true;
  if (expiryYear === currentYear && expiryMonth < currentMonth) return true;
  return false;
};