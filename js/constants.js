// Game constants

export const APP_VERSION = '1.2.0';
export const REPO_URL    = 'https://github.com/commjoen/generatedracer';

export const WORLD_W = 3000;
export const WORLD_H = 2000;

// Track
export const TRACK_WIDTH = 232;  // road width in world pixels
export const TRACK_BORDER = 18;  // curb width each side

// Car dimensions (length × width when facing right)
export const CAR_LENGTH = 52;
export const CAR_WIDTH  = 28;

// Race setup
export const NUM_LAPS    = 3;
export const NUM_AI      = 5;
export const MAX_PLAYERS = 6;

// Car colours (index 0 = human player)
export const CAR_COLORS = [
  '#e74c3c',  // Red   – player
  '#3498db',  // Blue
  '#2ecc71',  // Green
  '#f39c12',  // Orange
  '#9b59b6',  // Purple
  '#1abc9c',  // Teal
];
export const CAR_NAMES = ['YOU', 'CPU 1', 'CPU 2', 'CPU 3', 'CPU 4', 'CPU 5'];
export const ORDINALS  = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

// Physics (world-pixels / second)
export const MAX_SPEED         = 520;
export const ACCELERATION = 425;
export const BRAKING = 830;
export const TURN_RATE = 3.05;

// Turbo boost
export const TURBO_DURATION   = 1.75; // seconds active
export const TURBO_SPEED_MULT = 1.36; // speed multiplier when boosting
// One use is granted at the start of each of the three laps, never by a timer.
export const SIMULATION_STEP = 1 / 60;

// Turbo flame visual
export const TURBO_FLAME_BASE = 22;  // base flame length (px)
export const TURBO_FLAME_RAND = 12;  // random length variation (px)
