/**
 * NCERT chapter listings for the classes beyond Class 8.
 *
 * These are real chapter names, so the catalog stops being a set of empty
 * shells. Two honest caveats:
 *
 *  - NCERT rationalised the syllabus from 2023–24 and dropped or merged some
 *    chapters. Check these against the edition your students actually use
 *    before selling a class, and edit them in the admin area rather than here.
 *  - Topic breakdowns and runtimes are not real. Every chapter is split into
 *    placeholder parts until the lessons are produced, which is why these
 *    classes carry no `videoUrl`.
 */
export type SyllabusChapter = { title: string; topics: number }

export const SYLLABUS: Record<string, { maths: SyllabusChapter[]; science: SyllabusChapter[] }> = {
  'class-6': {
    maths: [
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
    ].map((title) => ({ title, topics: 3 })),
    science: [
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
    ].map((title) => ({ title, topics: 3 })),
  },

  'class-7': {
    maths: [
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
    ].map((title) => ({ title, topics: 3 })),
    science: [
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
    ].map((title) => ({ title, topics: 3 })),
  },

  'class-9': {
    maths: [
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
    ].map((title) => ({ title, topics: 4 })),
    science: [
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
    ].map((title) => ({ title, topics: 4 })),
  },

  'class-10': {
    maths: [
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
    ].map((title) => ({ title, topics: 4 })),
    science: [
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
    ].map((title) => ({ title, topics: 4 })),
  },
}
