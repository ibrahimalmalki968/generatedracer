export const PROTOCOL_VERSION = 1;
export const MAX_HUMANS = 6;
export const NEUTRAL = Object.freeze({ steer: 0, gas: 0, brake: 0, turbo: false });

export function displayName(value, max = 20) {
  if (typeof value !== 'string') throw new Error('Enter a nickname.');
  const text = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  if ([...text].length < 1 || [...text].length > max) throw new Error(`Use between 1 and ${max} characters.`);
  return text;
}

export function controls(message) {
  if (!Number.isSafeInteger(message.seq) || message.seq < 1 || message.seq > 1e9 ||
      !Number.isSafeInteger(message.boost) || message.boost < 0 || message.boost > 1e6 ||
      typeof message.raceId !== 'string' || message.raceId.length > 64 ||
      !['steer', 'gas', 'brake'].every(k => Number.isFinite(message[k])) ||
      Math.abs(message.steer) > 1 || message.gas < 0 || message.gas > 1 || message.brake < 0 || message.brake > 1 ||
      Object.keys(message).some(k => !['type', 'raceId', 'seq', 'boost', 'steer', 'gas', 'brake'].includes(k))) {
    throw new Error('Invalid control input.');
  }
  return { steer: message.steer, gas: message.brake ? 0 : message.gas, brake: message.brake, turbo: false };
}
