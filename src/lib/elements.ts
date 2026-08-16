/**
 * Periodic table data for all 118 elements.
 *
 * Stored as tuples rather than objects: the same nine fields repeat 118 times,
 * and the key names would be most of the file. Masses follow IUPAC's abridged
 * standard atomic weights; a value in [brackets] is the mass number of the most
 * stable known isotope, because the element has no stable form to average over.
 */

export type ElementCategory =
  | 'alkali'
  | 'alkaline'
  | 'transition'
  | 'post-transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble'
  | 'lanthanide'
  | 'actinide'
  | 'unknown'

export type ElementState = 'solid' | 'liquid' | 'gas' | 'unknown'

export type ChemElement = {
  z: number
  symbol: string
  name: string
  mass: string
  category: ElementCategory
  /** 1–18 for the s/p/d blocks; 0 for the f-block rows, which sit outside the grid. */
  group: number
  period: number
  state: ElementState
  /** Electron configuration in noble-gas shorthand. */
  config: string
}

const CATEGORY: Record<string, ElementCategory> = {
  am: 'alkali',
  ae: 'alkaline',
  tm: 'transition',
  pt: 'post-transition',
  ml: 'metalloid',
  nm: 'nonmetal',
  hl: 'halogen',
  ng: 'noble',
  ln: 'lanthanide',
  an: 'actinide',
  uk: 'unknown',
}

const STATE: Record<string, ElementState> = { s: 'solid', l: 'liquid', g: 'gas', u: 'unknown' }

type Row = [number, string, string, string, string, number, number, string, string]

// z, symbol, name, mass, category, group, period, state, configuration
const RAW: Row[] = [
  [1, 'H', 'Hydrogen', '1.008', 'nm', 1, 1, 'g', '1s1'],
  [2, 'He', 'Helium', '4.0026', 'ng', 18, 1, 'g', '1s2'],
  [3, 'Li', 'Lithium', '6.94', 'am', 1, 2, 's', '[He] 2s1'],
  [4, 'Be', 'Beryllium', '9.0122', 'ae', 2, 2, 's', '[He] 2s2'],
  [5, 'B', 'Boron', '10.81', 'ml', 13, 2, 's', '[He] 2s2 2p1'],
  [6, 'C', 'Carbon', '12.011', 'nm', 14, 2, 's', '[He] 2s2 2p2'],
  [7, 'N', 'Nitrogen', '14.007', 'nm', 15, 2, 'g', '[He] 2s2 2p3'],
  [8, 'O', 'Oxygen', '15.999', 'nm', 16, 2, 'g', '[He] 2s2 2p4'],
  [9, 'F', 'Fluorine', '18.998', 'hl', 17, 2, 'g', '[He] 2s2 2p5'],
  [10, 'Ne', 'Neon', '20.180', 'ng', 18, 2, 'g', '[He] 2s2 2p6'],
  [11, 'Na', 'Sodium', '22.990', 'am', 1, 3, 's', '[Ne] 3s1'],
  [12, 'Mg', 'Magnesium', '24.305', 'ae', 2, 3, 's', '[Ne] 3s2'],
  [13, 'Al', 'Aluminium', '26.982', 'pt', 13, 3, 's', '[Ne] 3s2 3p1'],
  [14, 'Si', 'Silicon', '28.085', 'ml', 14, 3, 's', '[Ne] 3s2 3p2'],
  [15, 'P', 'Phosphorus', '30.974', 'nm', 15, 3, 's', '[Ne] 3s2 3p3'],
  [16, 'S', 'Sulfur', '32.06', 'nm', 16, 3, 's', '[Ne] 3s2 3p4'],
  [17, 'Cl', 'Chlorine', '35.45', 'hl', 17, 3, 'g', '[Ne] 3s2 3p5'],
  [18, 'Ar', 'Argon', '39.95', 'ng', 18, 3, 'g', '[Ne] 3s2 3p6'],
  [19, 'K', 'Potassium', '39.098', 'am', 1, 4, 's', '[Ar] 4s1'],
  [20, 'Ca', 'Calcium', '40.078', 'ae', 2, 4, 's', '[Ar] 4s2'],
  [21, 'Sc', 'Scandium', '44.956', 'tm', 3, 4, 's', '[Ar] 3d1 4s2'],
  [22, 'Ti', 'Titanium', '47.867', 'tm', 4, 4, 's', '[Ar] 3d2 4s2'],
  [23, 'V', 'Vanadium', '50.942', 'tm', 5, 4, 's', '[Ar] 3d3 4s2'],
  [24, 'Cr', 'Chromium', '51.996', 'tm', 6, 4, 's', '[Ar] 3d5 4s1'],
  [25, 'Mn', 'Manganese', '54.938', 'tm', 7, 4, 's', '[Ar] 3d5 4s2'],
  [26, 'Fe', 'Iron', '55.845', 'tm', 8, 4, 's', '[Ar] 3d6 4s2'],
  [27, 'Co', 'Cobalt', '58.933', 'tm', 9, 4, 's', '[Ar] 3d7 4s2'],
  [28, 'Ni', 'Nickel', '58.693', 'tm', 10, 4, 's', '[Ar] 3d8 4s2'],
  [29, 'Cu', 'Copper', '63.546', 'tm', 11, 4, 's', '[Ar] 3d10 4s1'],
  [30, 'Zn', 'Zinc', '65.38', 'tm', 12, 4, 's', '[Ar] 3d10 4s2'],
  [31, 'Ga', 'Gallium', '69.723', 'pt', 13, 4, 's', '[Ar] 3d10 4s2 4p1'],
  [32, 'Ge', 'Germanium', '72.630', 'ml', 14, 4, 's', '[Ar] 3d10 4s2 4p2'],
  [33, 'As', 'Arsenic', '74.922', 'ml', 15, 4, 's', '[Ar] 3d10 4s2 4p3'],
  [34, 'Se', 'Selenium', '78.971', 'nm', 16, 4, 's', '[Ar] 3d10 4s2 4p4'],
  [35, 'Br', 'Bromine', '79.904', 'hl', 17, 4, 'l', '[Ar] 3d10 4s2 4p5'],
  [36, 'Kr', 'Krypton', '83.798', 'ng', 18, 4, 'g', '[Ar] 3d10 4s2 4p6'],
  [37, 'Rb', 'Rubidium', '85.468', 'am', 1, 5, 's', '[Kr] 5s1'],
  [38, 'Sr', 'Strontium', '87.62', 'ae', 2, 5, 's', '[Kr] 5s2'],
  [39, 'Y', 'Yttrium', '88.906', 'tm', 3, 5, 's', '[Kr] 4d1 5s2'],
  [40, 'Zr', 'Zirconium', '91.224', 'tm', 4, 5, 's', '[Kr] 4d2 5s2'],
  [41, 'Nb', 'Niobium', '92.906', 'tm', 5, 5, 's', '[Kr] 4d4 5s1'],
  [42, 'Mo', 'Molybdenum', '95.95', 'tm', 6, 5, 's', '[Kr] 4d5 5s1'],
  [43, 'Tc', 'Technetium', '[98]', 'tm', 7, 5, 's', '[Kr] 4d5 5s2'],
  [44, 'Ru', 'Ruthenium', '101.07', 'tm', 8, 5, 's', '[Kr] 4d7 5s1'],
  [45, 'Rh', 'Rhodium', '102.91', 'tm', 9, 5, 's', '[Kr] 4d8 5s1'],
  [46, 'Pd', 'Palladium', '106.42', 'tm', 10, 5, 's', '[Kr] 4d10'],
  [47, 'Ag', 'Silver', '107.87', 'tm', 11, 5, 's', '[Kr] 4d10 5s1'],
  [48, 'Cd', 'Cadmium', '112.41', 'tm', 12, 5, 's', '[Kr] 4d10 5s2'],
  [49, 'In', 'Indium', '114.82', 'pt', 13, 5, 's', '[Kr] 4d10 5s2 5p1'],
  [50, 'Sn', 'Tin', '118.71', 'pt', 14, 5, 's', '[Kr] 4d10 5s2 5p2'],
  [51, 'Sb', 'Antimony', '121.76', 'ml', 15, 5, 's', '[Kr] 4d10 5s2 5p3'],
  [52, 'Te', 'Tellurium', '127.60', 'ml', 16, 5, 's', '[Kr] 4d10 5s2 5p4'],
  [53, 'I', 'Iodine', '126.90', 'hl', 17, 5, 's', '[Kr] 4d10 5s2 5p5'],
  [54, 'Xe', 'Xenon', '131.29', 'ng', 18, 5, 'g', '[Kr] 4d10 5s2 5p6'],
  [55, 'Cs', 'Caesium', '132.91', 'am', 1, 6, 's', '[Xe] 6s1'],
  [56, 'Ba', 'Barium', '137.33', 'ae', 2, 6, 's', '[Xe] 6s2'],
  [57, 'La', 'Lanthanum', '138.91', 'ln', 0, 6, 's', '[Xe] 5d1 6s2'],
  [58, 'Ce', 'Cerium', '140.12', 'ln', 0, 6, 's', '[Xe] 4f1 5d1 6s2'],
  [59, 'Pr', 'Praseodymium', '140.91', 'ln', 0, 6, 's', '[Xe] 4f3 6s2'],
  [60, 'Nd', 'Neodymium', '144.24', 'ln', 0, 6, 's', '[Xe] 4f4 6s2'],
  [61, 'Pm', 'Promethium', '[145]', 'ln', 0, 6, 's', '[Xe] 4f5 6s2'],
  [62, 'Sm', 'Samarium', '150.36', 'ln', 0, 6, 's', '[Xe] 4f6 6s2'],
  [63, 'Eu', 'Europium', '151.96', 'ln', 0, 6, 's', '[Xe] 4f7 6s2'],
  [64, 'Gd', 'Gadolinium', '157.25', 'ln', 0, 6, 's', '[Xe] 4f7 5d1 6s2'],
  [65, 'Tb', 'Terbium', '158.93', 'ln', 0, 6, 's', '[Xe] 4f9 6s2'],
  [66, 'Dy', 'Dysprosium', '162.50', 'ln', 0, 6, 's', '[Xe] 4f10 6s2'],
  [67, 'Ho', 'Holmium', '164.93', 'ln', 0, 6, 's', '[Xe] 4f11 6s2'],
  [68, 'Er', 'Erbium', '167.26', 'ln', 0, 6, 's', '[Xe] 4f12 6s2'],
  [69, 'Tm', 'Thulium', '168.93', 'ln', 0, 6, 's', '[Xe] 4f13 6s2'],
  [70, 'Yb', 'Ytterbium', '173.05', 'ln', 0, 6, 's', '[Xe] 4f14 6s2'],
  [71, 'Lu', 'Lutetium', '174.97', 'ln', 0, 6, 's', '[Xe] 4f14 5d1 6s2'],
  [72, 'Hf', 'Hafnium', '178.49', 'tm', 4, 6, 's', '[Xe] 4f14 5d2 6s2'],
  [73, 'Ta', 'Tantalum', '180.95', 'tm', 5, 6, 's', '[Xe] 4f14 5d3 6s2'],
  [74, 'W', 'Tungsten', '183.84', 'tm', 6, 6, 's', '[Xe] 4f14 5d4 6s2'],
  [75, 'Re', 'Rhenium', '186.21', 'tm', 7, 6, 's', '[Xe] 4f14 5d5 6s2'],
  [76, 'Os', 'Osmium', '190.23', 'tm', 8, 6, 's', '[Xe] 4f14 5d6 6s2'],
  [77, 'Ir', 'Iridium', '192.22', 'tm', 9, 6, 's', '[Xe] 4f14 5d7 6s2'],
  [78, 'Pt', 'Platinum', '195.08', 'tm', 10, 6, 's', '[Xe] 4f14 5d9 6s1'],
  [79, 'Au', 'Gold', '196.97', 'tm', 11, 6, 's', '[Xe] 4f14 5d10 6s1'],
  [80, 'Hg', 'Mercury', '200.59', 'tm', 12, 6, 'l', '[Xe] 4f14 5d10 6s2'],
  [81, 'Tl', 'Thallium', '204.38', 'pt', 13, 6, 's', '[Xe] 4f14 5d10 6s2 6p1'],
  [82, 'Pb', 'Lead', '207.2', 'pt', 14, 6, 's', '[Xe] 4f14 5d10 6s2 6p2'],
  [83, 'Bi', 'Bismuth', '208.98', 'pt', 15, 6, 's', '[Xe] 4f14 5d10 6s2 6p3'],
  [84, 'Po', 'Polonium', '[209]', 'pt', 16, 6, 's', '[Xe] 4f14 5d10 6s2 6p4'],
  [85, 'At', 'Astatine', '[210]', 'hl', 17, 6, 's', '[Xe] 4f14 5d10 6s2 6p5'],
  [86, 'Rn', 'Radon', '[222]', 'ng', 18, 6, 'g', '[Xe] 4f14 5d10 6s2 6p6'],
  [87, 'Fr', 'Francium', '[223]', 'am', 1, 7, 's', '[Rn] 7s1'],
  [88, 'Ra', 'Radium', '[226]', 'ae', 2, 7, 's', '[Rn] 7s2'],
  [89, 'Ac', 'Actinium', '[227]', 'an', 0, 7, 's', '[Rn] 6d1 7s2'],
  [90, 'Th', 'Thorium', '232.04', 'an', 0, 7, 's', '[Rn] 6d2 7s2'],
  [91, 'Pa', 'Protactinium', '231.04', 'an', 0, 7, 's', '[Rn] 5f2 6d1 7s2'],
  [92, 'U', 'Uranium', '238.03', 'an', 0, 7, 's', '[Rn] 5f3 6d1 7s2'],
  [93, 'Np', 'Neptunium', '[237]', 'an', 0, 7, 's', '[Rn] 5f4 6d1 7s2'],
  [94, 'Pu', 'Plutonium', '[244]', 'an', 0, 7, 's', '[Rn] 5f6 7s2'],
  [95, 'Am', 'Americium', '[243]', 'an', 0, 7, 's', '[Rn] 5f7 7s2'],
  [96, 'Cm', 'Curium', '[247]', 'an', 0, 7, 's', '[Rn] 5f7 6d1 7s2'],
  [97, 'Bk', 'Berkelium', '[247]', 'an', 0, 7, 's', '[Rn] 5f9 7s2'],
  [98, 'Cf', 'Californium', '[251]', 'an', 0, 7, 's', '[Rn] 5f10 7s2'],
  [99, 'Es', 'Einsteinium', '[252]', 'an', 0, 7, 's', '[Rn] 5f11 7s2'],
  [100, 'Fm', 'Fermium', '[257]', 'an', 0, 7, 's', '[Rn] 5f12 7s2'],
  [101, 'Md', 'Mendelevium', '[258]', 'an', 0, 7, 's', '[Rn] 5f13 7s2'],
  [102, 'No', 'Nobelium', '[259]', 'an', 0, 7, 's', '[Rn] 5f14 7s2'],
  [103, 'Lr', 'Lawrencium', '[266]', 'an', 0, 7, 's', '[Rn] 5f14 7s2 7p1'],
  [104, 'Rf', 'Rutherfordium', '[267]', 'tm', 4, 7, 'u', '[Rn] 5f14 6d2 7s2'],
  [105, 'Db', 'Dubnium', '[268]', 'tm', 5, 7, 'u', '[Rn] 5f14 6d3 7s2'],
  [106, 'Sg', 'Seaborgium', '[269]', 'tm', 6, 7, 'u', '[Rn] 5f14 6d4 7s2'],
  [107, 'Bh', 'Bohrium', '[270]', 'tm', 7, 7, 'u', '[Rn] 5f14 6d5 7s2'],
  [108, 'Hs', 'Hassium', '[269]', 'tm', 8, 7, 'u', '[Rn] 5f14 6d6 7s2'],
  [109, 'Mt', 'Meitnerium', '[278]', 'uk', 9, 7, 'u', '[Rn] 5f14 6d7 7s2'],
  [110, 'Ds', 'Darmstadtium', '[281]', 'uk', 10, 7, 'u', '[Rn] 5f14 6d8 7s2'],
  [111, 'Rg', 'Roentgenium', '[282]', 'uk', 11, 7, 'u', '[Rn] 5f14 6d9 7s2'],
  [112, 'Cn', 'Copernicium', '[285]', 'tm', 12, 7, 'u', '[Rn] 5f14 6d10 7s2'],
  [113, 'Nh', 'Nihonium', '[286]', 'uk', 13, 7, 'u', '[Rn] 5f14 6d10 7s2 7p1'],
  [114, 'Fl', 'Flerovium', '[289]', 'pt', 14, 7, 'u', '[Rn] 5f14 6d10 7s2 7p2'],
  [115, 'Mc', 'Moscovium', '[290]', 'uk', 15, 7, 'u', '[Rn] 5f14 6d10 7s2 7p3'],
  [116, 'Lv', 'Livermorium', '[293]', 'uk', 16, 7, 'u', '[Rn] 5f14 6d10 7s2 7p4'],
  [117, 'Ts', 'Tennessine', '[294]', 'uk', 17, 7, 'u', '[Rn] 5f14 6d10 7s2 7p5'],
  [118, 'Og', 'Oganesson', '[294]', 'uk', 18, 7, 'u', '[Rn] 5f14 6d10 7s2 7p6'],
]

export const ELEMENTS: ChemElement[] = RAW.map(
  ([z, symbol, name, mass, cat, group, period, state, config]) => ({
    z,
    symbol,
    name,
    mass,
    category: CATEGORY[cat] ?? 'unknown',
    group,
    period,
    state: STATE[state] ?? 'unknown',
    config,
  }),
)

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  alkali: 'Alkali metal',
  alkaline: 'Alkaline earth metal',
  transition: 'Transition metal',
  'post-transition': 'Post-transition metal',
  metalloid: 'Metalloid',
  nonmetal: 'Reactive nonmetal',
  halogen: 'Halogen',
  noble: 'Noble gas',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
  unknown: 'Unknown properties',
}

/**
 * Tailwind classes per category. Written out in full rather than composed at
 * runtime, because Tailwind only ships classes it can see as literal strings.
 */
export const CATEGORY_STYLES: Record<ElementCategory, string> = {
  alkali: 'bg-rose-100 text-rose-900 hover:bg-rose-200',
  alkaline: 'bg-orange-100 text-orange-900 hover:bg-orange-200',
  transition: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  'post-transition': 'bg-teal-100 text-teal-900 hover:bg-teal-200',
  metalloid: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
  nonmetal: 'bg-sky-100 text-sky-900 hover:bg-sky-200',
  halogen: 'bg-cyan-100 text-cyan-900 hover:bg-cyan-200',
  noble: 'bg-violet-100 text-violet-900 hover:bg-violet-200',
  lanthanide: 'bg-fuchsia-100 text-fuchsia-900 hover:bg-fuchsia-200',
  actinide: 'bg-pink-100 text-pink-900 hover:bg-pink-200',
  unknown: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
}

/**
 * Where an element sits in the rendered grid. The f-block is lifted out of the
 * main table into its own two rows, which is how school tables print it, so
 * those elements get rows 8 and 9 and a column counted from lanthanum.
 */
export function gridPosition(el: ChemElement): { column: number; row: number } {
  if (el.category === 'lanthanide') return { column: el.z - 57 + 3, row: 8 }
  if (el.category === 'actinide') return { column: el.z - 89 + 3, row: 9 }
  return { column: el.group, row: el.period }
}
