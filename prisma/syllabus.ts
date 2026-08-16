/**
 * NCERT chapter listings for every class except Class 8, whose catalog is
 * hand-written in seed.ts.
 *
 * These are real chapter names, so the catalog stops being a set of empty
 * shells. Three honest caveats:
 *
 *  - Listings follow the **rationalised** syllabus (2023–24 onwards), so the
 *    chapters NCERT dropped are absent: Physical World from Class 11 Physics,
 *    five chapters from Class 11 Chemistry, Communication Systems from Class 12
 *    Physics, and so on. Check them against the edition your students actually
 *    use before selling a class, and edit them in the admin area rather than here.
 *  - Class 5 uses the long-standing Math-Magic and Looking Around books. NCERT
 *    is replacing these under NEP 2020 with Maths Mela and Our Wondrous World;
 *    swap them when your schools do.
 *  - Topic breakdowns and runtimes are not real. Every chapter is split into
 *    placeholder parts until the lessons are produced, which is why every class
 *    here carries no `videoUrl`.
 */
export type SyllabusChapter = { title: string; topics: number }
export type SyllabusSubject = { slug: string; chapters: SyllabusChapter[] }

/**
 * Subject presentation, keyed by slug. Every subject any class references must
 * appear here — the seed builds the `Subject` rows from this map, so a missing
 * entry is a seeding error rather than a silently untitled course.
 */
export const SUBJECT_META: Record<
  string,
  { name: string; icon: string; colorFrom: string; colorTo: string }
> = {
  maths: { name: 'Maths', icon: 'sigma', colorFrom: '#3B82F6', colorTo: '#2C5282' },
  science: { name: 'Science', icon: 'flask', colorFrom: '#22C55E', colorTo: '#15803D' },
  'ai-gen-ai': { name: 'AI & Gen AI', icon: 'sparkles', colorFrom: '#F59E0B', colorTo: '#EA580C' },
  evs: { name: 'EVS', icon: 'leaf', colorFrom: '#10B981', colorTo: '#047857' },
  physics: { name: 'Physics', icon: 'atom', colorFrom: '#6366F1', colorTo: '#4338CA' },
  chemistry: { name: 'Chemistry', icon: 'beaker', colorFrom: '#14B8A6', colorTo: '#0F766E' },
  biology: { name: 'Biology', icon: 'dna', colorFrom: '#84CC16', colorTo: '#4D7C0F' },
  accountancy: { name: 'Accountancy', icon: 'ledger', colorFrom: '#F97316', colorTo: '#C2410C' },
  'business-studies': {
    name: 'Business Studies',
    icon: 'briefcase',
    colorFrom: '#8B5CF6',
    colorTo: '#6D28D9',
  },
  economics: { name: 'Economics', icon: 'trend', colorFrom: '#EC4899', colorTo: '#BE185D' },
}

/** Splits a plain list of titles into chapters with a placeholder topic count. */
const chapters = (topics: number, titles: string[]): SyllabusChapter[] =>
  titles.map((title) => ({ title, topics }))

export const SYLLABUS: Record<string, SyllabusSubject[]> = {
  // --- Primary --------------------------------------------------------------
  'class-5': [
    {
      slug: 'maths',
      chapters: chapters(2, [
        'The Fish Tale',
        'Shapes and Angles',
        'How Many Squares?',
        'Parts and Wholes',
        'Does it Look the Same?',
        "Be My Multiple, I'll be Your Factor",
        'Can You See the Pattern?',
        'Mapping Your Way',
        'Boxes and Sketches',
        'Tenths and Hundredths',
        'Area and its Boundary',
        'Smart Charts',
        'Ways to Multiply and Divide',
        'How Big? How Heavy?',
      ]),
    },
    {
      slug: 'evs',
      chapters: chapters(2, [
        'Super Senses',
        "A Snake Charmer's Story",
        'From Tasting to Digesting',
        'Mangoes Round the Year',
        'Seeds and Seeds',
        'Every Drop Counts',
        'Experiments with Water',
        'A Treat for Mosquitoes',
        'Up You Go',
        'Walls Tell Stories',
        'Sunita in Space',
        'What if it Finishes?',
        'A Shelter so High',
        'When the Earth Shook',
        'Blow Hot, Blow Cold',
        'Who will do this Work?',
        'Across the Wall',
        'No Place for Us?',
        "A Seed tells a Farmer's Story",
        'Whose Forests?',
        'Like Father, Like Daughter',
        'On the Move Again',
      ]),
    },
  ],

  // --- Middle school --------------------------------------------------------
  'class-6': [
    {
      slug: 'maths',
      chapters: chapters(3, [
        'Knowing Our Numbers',
        'Whole Numbers',
        'Playing with Numbers',
        'Basic Geometrical Ideas',
        'Understanding Elementary Shapes',
        'Integers',
        'Fractions',
        'Decimals',
        'Data Handling',
        'Mensuration',
        'Algebra',
        'Ratio and Proportion',
        'Symmetry',
        'Practical Geometry',
      ]),
    },
    {
      slug: 'science',
      chapters: chapters(3, [
        'Food: Where Does It Come From?',
        'Components of Food',
        'Fibre to Fabric',
        'Sorting Materials into Groups',
        'Separation of Substances',
        'Changes Around Us',
        'Getting to Know Plants',
        'Body Movements',
        'The Living Organisms and Their Surroundings',
        'Motion and Measurement of Distances',
        'Light, Shadows and Reflections',
        'Electricity and Circuits',
        'Fun with Magnets',
        'Water',
        'Air Around Us',
        'Garbage In, Garbage Out',
      ]),
    },
  ],

  'class-7': [
    {
      slug: 'maths',
      chapters: chapters(3, [
        'Integers',
        'Fractions and Decimals',
        'Data Handling',
        'Simple Equations',
        'Lines and Angles',
        'The Triangle and its Properties',
        'Congruence of Triangles',
        'Comparing Quantities',
        'Rational Numbers',
        'Practical Geometry',
        'Perimeter and Area',
        'Algebraic Expressions',
        'Exponents and Powers',
        'Symmetry',
        'Visualising Solid Shapes',
      ]),
    },
    {
      slug: 'science',
      chapters: chapters(3, [
        'Nutrition in Plants',
        'Nutrition in Animals',
        'Fibre to Fabric',
        'Heat',
        'Acids, Bases and Salts',
        'Physical and Chemical Changes',
        'Weather, Climate and Adaptations of Animals to Climate',
        'Winds, Storms and Cyclones',
        'Soil',
        'Respiration in Organisms',
        'Transportation in Animals and Plants',
        'Reproduction in Plants',
        'Motion and Time',
        'Electric Current and its Effects',
        'Light',
        'Water: A Precious Resource',
        'Forests: Our Lifeline',
        'Wastewater Story',
      ]),
    },
  ],

  // --- Secondary ------------------------------------------------------------
  'class-9': [
    {
      slug: 'maths',
      chapters: chapters(4, [
        'Number Systems',
        'Polynomials',
        'Coordinate Geometry',
        'Linear Equations in Two Variables',
        "Introduction to Euclid's Geometry",
        'Lines and Angles',
        'Triangles',
        'Quadrilaterals',
        'Circles',
        "Heron's Formula",
        'Surface Areas and Volumes',
        'Statistics',
        'Probability',
      ]),
    },
    {
      slug: 'science',
      chapters: chapters(4, [
        'Matter in Our Surroundings',
        'Is Matter Around Us Pure?',
        'Atoms and Molecules',
        'Structure of the Atom',
        'The Fundamental Unit of Life',
        'Tissues',
        'Motion',
        'Force and Laws of Motion',
        'Gravitation',
        'Work and Energy',
        'Sound',
        'Improvement in Food Resources',
      ]),
    },
  ],

  'class-10': [
    {
      slug: 'maths',
      chapters: chapters(4, [
        'Real Numbers',
        'Polynomials',
        'Pair of Linear Equations in Two Variables',
        'Quadratic Equations',
        'Arithmetic Progressions',
        'Triangles',
        'Coordinate Geometry',
        'Introduction to Trigonometry',
        'Some Applications of Trigonometry',
        'Circles',
        'Areas Related to Circles',
        'Surface Areas and Volumes',
        'Statistics',
        'Probability',
      ]),
    },
    {
      slug: 'science',
      chapters: chapters(4, [
        'Chemical Reactions and Equations',
        'Acids, Bases and Salts',
        'Metals and Non-metals',
        'Carbon and its Compounds',
        'Life Processes',
        'Control and Coordination',
        'How do Organisms Reproduce?',
        'Heredity',
        'Light — Reflection and Refraction',
        'The Human Eye and the Colourful World',
        'Electricity',
        'Magnetic Effects of Electric Current',
        'Our Environment',
      ]),
    },
  ],

  // --- Senior secondary, science stream -------------------------------------
  'class-11': [
    {
      slug: 'physics',
      chapters: chapters(5, [
        'Units and Measurements',
        'Motion in a Straight Line',
        'Motion in a Plane',
        'Laws of Motion',
        'Work, Energy and Power',
        'System of Particles and Rotational Motion',
        'Gravitation',
        'Mechanical Properties of Solids',
        'Mechanical Properties of Fluids',
        'Thermal Properties of Matter',
        'Thermodynamics',
        'Kinetic Theory',
        'Oscillations',
        'Waves',
      ]),
    },
    {
      slug: 'chemistry',
      chapters: chapters(5, [
        'Some Basic Concepts of Chemistry',
        'Structure of Atom',
        'Classification of Elements and Periodicity in Properties',
        'Chemical Bonding and Molecular Structure',
        'Thermodynamics',
        'Equilibrium',
        'Redox Reactions',
        'Organic Chemistry: Some Basic Principles and Techniques',
        'Hydrocarbons',
      ]),
    },
    {
      slug: 'biology',
      chapters: chapters(4, [
        'The Living World',
        'Biological Classification',
        'Plant Kingdom',
        'Animal Kingdom',
        'Morphology of Flowering Plants',
        'Anatomy of Flowering Plants',
        'Structural Organisation in Animals',
        'Cell: The Unit of Life',
        'Biomolecules',
        'Cell Cycle and Cell Division',
        'Photosynthesis in Higher Plants',
        'Respiration in Plants',
        'Plant Growth and Development',
        'Breathing and Exchange of Gases',
        'Body Fluids and Circulation',
        'Excretory Products and their Elimination',
        'Locomotion and Movement',
        'Neural Control and Coordination',
        'Chemical Coordination and Integration',
      ]),
    },
    {
      slug: 'maths',
      chapters: chapters(5, [
        'Sets',
        'Relations and Functions',
        'Trigonometric Functions',
        'Complex Numbers and Quadratic Equations',
        'Linear Inequalities',
        'Permutations and Combinations',
        'Binomial Theorem',
        'Sequences and Series',
        'Straight Lines',
        'Conic Sections',
        'Introduction to Three Dimensional Geometry',
        'Limits and Derivatives',
        'Statistics',
        'Probability',
      ]),
    },
  ],

  'class-12': [
    {
      slug: 'physics',
      chapters: chapters(5, [
        'Electric Charges and Fields',
        'Electrostatic Potential and Capacitance',
        'Current Electricity',
        'Moving Charges and Magnetism',
        'Magnetism and Matter',
        'Electromagnetic Induction',
        'Alternating Current',
        'Electromagnetic Waves',
        'Ray Optics and Optical Instruments',
        'Wave Optics',
        'Dual Nature of Radiation and Matter',
        'Atoms',
        'Nuclei',
        'Semiconductor Electronics: Materials, Devices and Simple Circuits',
      ]),
    },
    {
      slug: 'chemistry',
      chapters: chapters(5, [
        'Solutions',
        'Electrochemistry',
        'Chemical Kinetics',
        'The d- and f-Block Elements',
        'Coordination Compounds',
        'Haloalkanes and Haloarenes',
        'Alcohols, Phenols and Ethers',
        'Aldehydes, Ketones and Carboxylic Acids',
        'Amines',
        'Biomolecules',
      ]),
    },
    {
      slug: 'biology',
      chapters: chapters(4, [
        'Sexual Reproduction in Flowering Plants',
        'Human Reproduction',
        'Reproductive Health',
        'Principles of Inheritance and Variation',
        'Molecular Basis of Inheritance',
        'Evolution',
        'Human Health and Disease',
        'Microbes in Human Welfare',
        'Biotechnology: Principles and Processes',
        'Biotechnology and its Applications',
        'Organisms and Populations',
        'Ecosystem',
        'Biodiversity and Conservation',
      ]),
    },
    {
      slug: 'maths',
      chapters: chapters(5, [
        'Relations and Functions',
        'Inverse Trigonometric Functions',
        'Matrices',
        'Determinants',
        'Continuity and Differentiability',
        'Application of Derivatives',
        'Integrals',
        'Application of Integrals',
        'Differential Equations',
        'Vector Algebra',
        'Three Dimensional Geometry',
        'Linear Programming',
        'Probability',
      ]),
    },
  ],

  // --- Senior secondary, commerce stream ------------------------------------
  // Accountancy and Economics ship as two books each; both are listed in one
  // course, in book order, rather than split into separate courses.
  'class-11-commerce': [
    {
      slug: 'accountancy',
      chapters: chapters(4, [
        'Introduction to Accounting',
        'Theory Base of Accounting',
        'Recording of Transactions — I',
        'Recording of Transactions — II',
        'Bank Reconciliation Statement',
        'Trial Balance and Rectification of Errors',
        'Depreciation, Provisions and Reserves',
        'Bills of Exchange',
        'Financial Statements — I',
        'Financial Statements — II',
      ]),
    },
    {
      slug: 'business-studies',
      chapters: chapters(4, [
        'Business, Trade and Commerce',
        'Forms of Business Organisation',
        'Private, Public and Global Enterprises',
        'Business Services',
        'Emerging Modes of Business',
        'Social Responsibilities of Business and Business Ethics',
        'Formation of a Company',
        'Sources of Business Finance',
        'Small Business and Entrepreneurship',
        'Internal Trade',
        'International Business',
      ]),
    },
    {
      slug: 'economics',
      chapters: chapters(4, [
        // Statistics for Economics
        'Introduction (Statistics)',
        'Collection of Data',
        'Organisation of Data',
        'Presentation of Data',
        'Measures of Central Tendency',
        'Correlation',
        'Index Numbers',
        'Use of Statistical Tools',
        // Indian Economic Development
        'Indian Economy on the Eve of Independence',
        'Indian Economy 1950–1990',
        'Liberalisation, Privatisation and Globalisation: An Appraisal',
        'Human Capital Formation in India',
        'Rural Development',
        'Employment: Growth, Informalisation and Other Issues',
        'Environment and Sustainable Development',
        'Comparative Development Experiences of India and its Neighbours',
      ]),
    },
  ],

  'class-12-commerce': [
    {
      slug: 'accountancy',
      chapters: chapters(4, [
        // Part I — Accounting for Partnership Firms and Companies
        'Accounting for Partnership: Basic Concepts',
        'Reconstitution of a Partnership Firm — Admission of a Partner',
        'Reconstitution of a Partnership Firm — Retirement/Death of a Partner',
        'Dissolution of Partnership Firm',
        // Part II — Company Accounts and Analysis of Financial Statements
        'Accounting for Share Capital',
        'Issue and Redemption of Debentures',
        'Financial Statements of a Company',
        'Analysis of Financial Statements',
        'Accounting Ratios',
        'Cash Flow Statement',
      ]),
    },
    {
      slug: 'business-studies',
      chapters: chapters(4, [
        'Nature and Significance of Management',
        'Principles of Management',
        'Business Environment',
        'Planning',
        'Organising',
        'Staffing',
        'Directing',
        'Controlling',
        'Financial Management',
        'Marketing Management',
        'Consumer Protection',
      ]),
    },
    {
      slug: 'economics',
      chapters: chapters(4, [
        // Introductory Microeconomics
        'Introduction (Microeconomics)',
        'Theory of Consumer Behaviour',
        'Production and Costs',
        'The Theory of the Firm under Perfect Competition',
        'Market Equilibrium',
        'Non-Competitive Markets',
        // Introductory Macroeconomics
        'Introduction (Macroeconomics)',
        'National Income Accounting',
        'Money and Banking',
        'Determination of Income and Employment',
        'Government Budget and the Economy',
        'Open Economy Macroeconomics',
      ]),
    },
  ],
}
