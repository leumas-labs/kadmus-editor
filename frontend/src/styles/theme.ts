export const THEMES = {
  azure: {
    base:    "#0a0e13",
    panel:   "#0f1419",
    surface: "#141b22",
    raise:   "#1a212a",
    line:    "#1d2633",
    hair:    "#1f2938",
    text:    "#e1e8f0",
    muted:   "#7a8599",
    subtle:  "#4f5968",
    faint:   "#2d3744",
    sky:     "#6ba3e0",
    sienna:  "#6ba3e0",
    sage:    "#7fc4a8",
    amber:   "#7ec9e0",
    ink:     "#92b5e8",
    rust:    "#7892b8",
    rose:    "#e07072",
  },
  espresso: {
    base:    "#0d0d0d", // Very dark charcoal warm brown
    panel:   "#121111", // Warm panel
    surface: "#181717", // Dropdown surfaces
    raise:   "#1e1d1d", // Cards raise
    line:    "#222020", // Divider lines
    hair:    "#282525", // Border lines
    text:    "#c5beb5", // Warm cream/sand text
    muted:   "#8c8378", // Muted warm gray
    subtle:  "#5c554e", // Subtle warm gray
    faint:   "#38332f", // Faint warm gray
    sky:     "#bda380", // Bronze highlight
    sienna:  "#bda380", // Bronze accent
    sage:    "#8ea485", // Warm sage green
    amber:   "#cca57a", // Muted amber/gold
    ink:     "#9b8da6", // Muted purple/gray
    rust:    "#a68572", // Warm rust
    rose:    "#b56c6e", // Muted rose
  },
  cobalt: {
    base:    "#131415", // Dark gray-black background
    panel:   "#181a1b", // Slightly lighter sidebar/panel
    surface: "#1f2224", // Dropdown surfaces
    raise:   "#25282b", // Cards raise
    line:    "#2b2e31", // Divider lines
    hair:    "#31353a", // Border lines
    text:    "#e3e8ed", // Light white-gray text
    muted:   "#88929d", // Muted slate gray
    subtle:  "#545e69", // Subtle slate gray
    faint:   "#343d46", // Faint slate gray
    sky:     "#4e80f7", // Vibrant cobalt blue accent
    sienna:  "#4e80f7", // Cobalt sienna/accent
    sage:    "#4fc48a", // Sage green
    amber:   "#e6ad45", // Amber gold
    ink:     "#a585e8", // Muted lavender
    rust:    "#e07d53", // Soft rust
    rose:    "#e65a5c", // Muted rose red
  }
};

export type ThemeName = 'azure' | 'espresso' | 'cobalt';

export const C = { ...THEMES.azure };

export const SYN = {
  get kw() { return C.sienna; },
  get ty() { return C.ink; },
  get fn() { return C.amber; },
  get st() { return C.sage; },
  get cm() { return C.faint; },
  get pp() { return C.rust; },
  get nu() { return C.rust; },
  get tx() { return C.text; }
};
