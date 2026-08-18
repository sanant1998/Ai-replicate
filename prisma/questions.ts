/**
 * Chapter quizzes.
 *
 * Keyed by "<subject slug>:<chapter index>". Only chapters listed here get a
 * quiz; the rest fall back to the AI practice generator in Tools. `answer` is
 * the 0-based option index for MCQ, and the literal expected value otherwise.
 *
 * Short-answer questions are used only where exactly one word is defensible —
 * anything with two reasonable phrasings is written as MCQ instead, so nobody
 * loses a mark to string matching.
 */
export type QuestionSeed = {
  kind: 'MCQ' | 'NUMERIC' | 'SHORT'
  prompt: string
  options?: string[]
  answer: string
  explanation?: string
  difficulty?: number
  marks?: number
}

export const QUESTIONS: Record<string, QuestionSeed[]> = {
  // ---------------------------------------------------------------- Maths
  'maths:1': [
    {
      kind: 'MCQ',
      prompt: 'Which of these is NOT a rational number?',
      options: ['3/4', '−5', '√2', '0.75'],
      answer: '2',
      explanation: '√2 cannot be written as p/q with integers p and q, so it is irrational.',
    },
    {
      kind: 'MCQ',
      prompt: 'What is the additive inverse of −7/9?',
      options: ['9/7', '7/9', '−9/7', '0'],
      answer: '1',
      explanation: 'The additive inverse is the number that adds to zero: −7/9 + 7/9 = 0.',
    },
    {
      kind: 'MCQ',
      prompt: 'The statement 3/5 × 7/2 = 7/2 × 3/5 illustrates which property?',
      options: [
        'Associative property',
        'Commutative property of multiplication',
        'Distributive property',
        'Closure property',
      ],
      answer: '1',
      explanation: 'Swapping the order of the two factors without changing the product is commutativity.',
    },
    {
      kind: 'NUMERIC',
      prompt: 'Find the product of 2/3 and 9/4. Give your answer as a decimal.',
      answer: '1.5',
      explanation: '(2 × 9) / (3 × 4) = 18/12 = 3/2 = 1.5',
      difficulty: 2,
    },
    {
      kind: 'SHORT',
      prompt: 'What is the multiplicative identity for rational numbers?',
      answer: '1',
      explanation: 'Multiplying any rational number by 1 leaves it unchanged.',
    },
  ],

  'maths:2': [
    {
      kind: 'NUMERIC',
      prompt: 'Solve for x:  2x + 5 = 13',
      answer: '4',
      explanation: '2x = 13 − 5 = 8, so x = 4.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is a linear equation in one variable?',
      options: ['x² + 1 = 0', '2x + 3 = 7', 'xy = 5', 'x + y = 2'],
      answer: '1',
      explanation: 'It has a single variable, and the highest power of that variable is 1.',
    },
    {
      kind: 'NUMERIC',
      prompt: 'If 3(x − 2) = 9, what is x?',
      answer: '5',
      explanation: 'x − 2 = 3, so x = 5.',
    },
    {
      kind: 'MCQ',
      prompt: 'How many solutions does a linear equation in one variable have?',
      options: ['None', 'Exactly one', 'Exactly two', 'Infinitely many'],
      answer: '1',
      explanation: 'A linear equation in one variable meets the axis once, so there is a single root.',
    },
    {
      kind: 'NUMERIC',
      prompt: 'The sum of two consecutive integers is 27. What is the smaller integer?',
      answer: '13',
      explanation: 'x + (x + 1) = 27 gives 2x = 26, so x = 13.',
      difficulty: 2,
      marks: 2,
    },
  ],

  'maths:6': [
    {
      kind: 'NUMERIC',
      prompt: 'What is the square of 15?',
      answer: '225',
    },
    {
      kind: 'NUMERIC',
      prompt: 'Find √169.',
      answer: '13',
      explanation: '13 × 13 = 169.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is a perfect square?',
      options: ['32', '48', '64', '72'],
      answer: '2',
      explanation: '64 = 8², the others have no integer square root.',
    },
    {
      kind: 'MCQ',
      prompt: 'A perfect square can never end in which of these digits?',
      options: ['1', '4', '8', '9'],
      answer: '2',
      explanation: 'Squares end only in 0, 1, 4, 5, 6 or 9 — never in 2, 3, 7 or 8.',
      difficulty: 2,
    },
    {
      kind: 'NUMERIC',
      prompt: 'How many non-square numbers lie between 4² and 5²?',
      answer: '8',
      explanation: 'Between n² and (n+1)² there are 2n non-square numbers. Here n = 4, so 8.',
      difficulty: 3,
      marks: 2,
    },
  ],

  // -------------------------------------------------------------- Science
  'science:1': [
    {
      kind: 'MCQ',
      prompt: 'The process of loosening and turning over the soil before sowing is called:',
      options: ['Sowing', 'Ploughing', 'Harvesting', 'Winnowing'],
      answer: '1',
      explanation: 'Ploughing loosens the soil so roots can breathe and reach nutrients.',
    },
    {
      kind: 'MCQ',
      prompt: 'Kharif crops are sown in which season?',
      options: ['Winter', 'The rainy season', 'Summer', 'Spring'],
      answer: '1',
      explanation: 'Kharif crops such as paddy and maize are sown with the monsoon, around June–July.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is a rabi crop?',
      options: ['Paddy', 'Maize', 'Wheat', 'Cotton'],
      answer: '2',
      explanation: 'Rabi crops are sown in winter; wheat is the standard example.',
    },
    {
      kind: 'SHORT',
      prompt: 'What is the removal of unwanted plants growing among the crop called?',
      answer: 'weeding',
    },
    {
      kind: 'SHORT',
      prompt: 'What is the process of separating grain from chaff called?',
      answer: 'winnowing',
      explanation: 'The lighter chaff is carried away by the wind while the heavier grain falls.',
    },
  ],

  'science:12': [
    {
      kind: 'MCQ',
      prompt: 'For the same pair of surfaces, which kind of friction is the smallest?',
      options: ['Static friction', 'Sliding friction', 'Rolling friction', 'They are all equal'],
      answer: '2',
      explanation: 'Rolling friction < sliding friction < static friction. This is why wheels are used.',
    },
    {
      kind: 'MCQ',
      prompt: 'Friction acts in which direction relative to the motion of an object?',
      options: ['Along the motion', 'Opposite to the motion', 'At right angles to it', 'It varies randomly'],
      answer: '1',
      explanation: 'Friction always opposes relative motion between two surfaces.',
    },
    {
      kind: 'MCQ',
      prompt: 'Polishing a surface until it is smoother generally:',
      options: ['Increases friction', 'Decreases friction', 'Has no effect', 'Removes friction entirely'],
      answer: '1',
      explanation: 'Smoother surfaces interlock less, so friction falls — but never to zero.',
    },
    {
      kind: 'MCQ',
      prompt: 'The friction experienced by an object moving through air is called:',
      options: ['Rolling friction', 'Static friction', 'Air resistance (drag)', 'Buoyancy'],
      answer: '2',
      explanation: 'Fluids exert friction too; in air it is called air resistance or drag.',
    },
    {
      kind: 'SHORT',
      prompt: 'Which instrument is used to measure force? (two words)',
      answer: 'spring balance',
    },
  ],

  // ------------------------------------------------------------ AI & Gen AI
  'ai-gen-ai:1': [
    {
      kind: 'MCQ',
      prompt: 'When working with an AI model, what is a "prompt"?',
      options: [
        'The model’s reply',
        'The instruction or question you give the model',
        'The speed of the response',
        'The name of the model',
      ],
      answer: '1',
    },
    {
      kind: 'MCQ',
      prompt: 'An AI assistant states a fact confidently, but the fact is simply untrue. This is usually called:',
      options: ['A bug', 'A hallucination', 'A crash', 'A prompt'],
      answer: '1',
      explanation:
        'Models generate plausible-sounding text, which sometimes means plausible-sounding falsehoods. Always verify.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is the safest thing to do with an AI answer to a homework question?',
      options: [
        'Copy it in exactly as your own work',
        'Use it to understand the method, then work the answer yourself',
        'Submit it without reading it',
        'Share your login so friends can copy too',
      ],
      answer: '1',
      explanation:
        'Using AI to learn the method is study. Submitting its output as your own is not, and most schools treat it as cheating.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these should you never type into an AI chatbot?',
      options: [
        'A maths question',
        'A request to explain a diagram',
        'Your home address and phone number',
        'A request for practice questions',
      ],
      answer: '2',
      explanation: 'Never share personal details — your address, phone number, or passwords — with any chatbot.',
    },
  ],

  // ---------------------------------------------------- Maths, remaining chapters
  'maths:3': [
    {
      kind: 'NUMERIC',
      prompt: 'What is the sum of the interior angles of a hexagon, in degrees?',
      answer: '720',
      explanation: '(n − 2) × 180° with n = 6 gives 4 × 180° = 720°.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which quadrilateral always has diagonals that bisect each other at right angles?',
      options: ['Rectangle', 'Rhombus', 'Trapezium', 'Kite'],
      answer: '1',
      explanation:
        'A rhombus has four equal sides, and its diagonals bisect each other perpendicularly. A rectangle’s diagonals bisect each other but are not perpendicular unless it is a square.',
      difficulty: 2,
    },
    {
      kind: 'NUMERIC',
      prompt: 'Each exterior angle of a regular polygon is 40°. How many sides does it have?',
      answer: '9',
      explanation: 'Exterior angles of any polygon sum to 360°, so n = 360 ÷ 40 = 9.',
      difficulty: 2,
      marks: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'In a parallelogram ABCD, angle A = 70°. What is angle B?',
      options: ['70°', '110°', '20°', '140°'],
      answer: '1',
      explanation: 'Adjacent angles of a parallelogram are supplementary: 180° − 70° = 110°.',
    },
  ],

  'maths:5': [
    {
      kind: 'MCQ',
      prompt: 'A die is rolled once. What is the probability of getting a number greater than 4?',
      options: ['1/6', '1/3', '1/2', '2/3'],
      answer: '1',
      explanation: 'Only 5 and 6 are greater than 4, so 2 outcomes out of 6, which is 1/3.',
    },
    {
      kind: 'NUMERIC',
      prompt:
        'In a pie chart showing 720 students, the sector for "cricket" measures 90°. How many students chose cricket?',
      answer: '180',
      explanation: '90/360 of 720 = 1/4 of 720 = 180.',
      difficulty: 2,
      marks: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'In a histogram, what does the width of each bar represent?',
      options: [
        'The frequency of the class',
        'The class interval',
        'The number of classes',
        'The total frequency',
      ],
      answer: '1',
      explanation:
        'Width shows the class interval and height shows the frequency — which is why the bars touch, unlike a bar graph.',
    },
    {
      kind: 'SHORT',
      prompt:
        'What name is given to a graph in which the bars touch each other because the data is continuous?',
      answer: 'histogram',
    },
  ],

  'maths:7': [
    {
      kind: 'NUMERIC',
      prompt: 'What is the cube root of 1728?',
      answer: '12',
      explanation: '1728 = 2³ × 2³ × 3³ = (2 × 2 × 3)³ = 12³.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these numbers is a perfect cube?',
      options: ['100', '216', '250', '400'],
      answer: '1',
      explanation: '216 = 6 × 6 × 6. The others have prime factors that do not group into threes.',
    },
    {
      kind: 'NUMERIC',
      prompt:
        'What is the smallest number by which 392 must be multiplied to make it a perfect cube?',
      answer: '7',
      explanation:
        '392 = 2³ × 7². The 7 appears twice, so one more 7 is needed to complete the triple.',
      difficulty: 3,
      marks: 3,
    },
    {
      kind: 'NUMERIC',
      prompt: 'What is the cube of −4?',
      answer: '-64',
      explanation: 'A negative number cubed stays negative: (−4) × (−4) × (−4) = −64.',
    },
  ],

  'maths:8': [
    {
      kind: 'NUMERIC',
      prompt:
        'A shirt marked ₹800 is sold at a 15% discount. What is the selling price, in rupees?',
      answer: '680',
      explanation: '15% of 800 = 120, so 800 − 120 = 680.',
    },
    {
      kind: 'NUMERIC',
      prompt:
        'Find the compound interest, in rupees, on ₹10,000 for 2 years at 10% per annum compounded annually.',
      answer: '2100',
      explanation: 'Amount = 10000 × (1.1)² = 12100, so the interest is 12100 − 10000 = 2100.',
      difficulty: 3,
      marks: 3,
    },
    {
      kind: 'MCQ',
      prompt:
        'An article bought for ₹500 is sold for ₹450. What is the loss percentage?',
      options: ['5%', '10%', '11.1%', '50%'],
      answer: '1',
      explanation: 'Loss = 50. Loss% = 50/500 × 100 = 10%, always taken on the cost price.',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'GST is charged on which amount?',
      options: [
        'The cost price',
        'The selling price, after any discount',
        'The marked price, before any discount',
        'The profit only',
      ],
      answer: '1',
      explanation: 'The discount is applied first; GST is then charged on the amount actually paid.',
      difficulty: 2,
    },
  ],

  'maths:9': [
    {
      kind: 'MCQ',
      prompt: 'Which identity gives the expansion of (a + b)²?',
      options: ['a² + b²', 'a² + 2ab + b²', 'a² − 2ab + b²', 'a² − b²'],
      answer: '1',
    },
    {
      kind: 'NUMERIC',
      prompt: 'Use an identity to evaluate 102² .',
      answer: '10404',
      explanation: '(100 + 2)² = 10000 + 400 + 4 = 10404.',
      difficulty: 2,
      marks: 2,
    },
    {
      kind: 'NUMERIC',
      prompt: 'Evaluate 98 × 102 using the identity (a − b)(a + b) = a² − b².',
      answer: '9996',
      explanation: '(100 − 2)(100 + 2) = 10000 − 4 = 9996.',
      difficulty: 2,
      marks: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'What is the degree of the polynomial 5x³y² − 4xy + 7?',
      options: ['2', '3', '5', '7'],
      answer: '2',
      explanation:
        'The degree of a term is the sum of its exponents; 5x³y² gives 3 + 2 = 5, the highest in the expression.',
      difficulty: 2,
    },
  ],

  'maths:11': [
    {
      kind: 'NUMERIC',
      prompt:
        'A trapezium has parallel sides 10 cm and 6 cm and a height of 5 cm. What is its area, in cm²?',
      answer: '40',
      explanation: '½ × (10 + 6) × 5 = ½ × 16 × 5 = 40.',
    },
    {
      kind: 'NUMERIC',
      prompt:
        'What is the total surface area of a cube of side 5 cm, in cm²?',
      answer: '150',
      explanation: '6 × side² = 6 × 25 = 150.',
    },
    {
      kind: 'NUMERIC',
      prompt:
        'A cylinder has radius 7 cm and height 10 cm. Taking π = 22/7, what is its volume in cm³?',
      answer: '1540',
      explanation: 'πr²h = (22/7) × 49 × 10 = 22 × 7 × 10 = 1540.',
      difficulty: 2,
      marks: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'Which unit is used to measure the volume of a solid?',
      options: ['cm', 'cm²', 'cm³', 'cm⁴'],
      answer: '2',
    },
  ],

  'maths:12': [
    {
      kind: 'NUMERIC',
      prompt: 'What is the value of 2⁻³ ? Give your answer as a decimal.',
      answer: '0.125',
      explanation: '2⁻³ = 1/2³ = 1/8 = 0.125.',
    },
    {
      kind: 'MCQ',
      prompt: 'What is the value of any non-zero number raised to the power 0?',
      options: ['0', '1', 'The number itself', 'Undefined'],
      answer: '1',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is 0.00000342 written in standard form?',
      options: ['3.42 × 10⁻⁶', '3.42 × 10⁶', '34.2 × 10⁻⁷', '3.42 × 10⁻⁵'],
      answer: '0',
      explanation:
        'Standard form puts exactly one non-zero digit before the decimal point; the point moves 6 places right.',
      difficulty: 2,
    },
    {
      kind: 'NUMERIC',
      prompt: 'Simplify 3⁵ ÷ 3³ .',
      answer: '9',
      explanation: 'Dividing powers of the same base subtracts the exponents: 3⁵⁻³ = 3² = 9.',
    },
  ],

  'maths:13': [
    {
      kind: 'MCQ',
      prompt:
        'The more workers there are, the fewer days a job takes. What kind of proportion is this?',
      options: ['Direct', 'Inverse', 'Neither', 'Both'],
      answer: '1',
    },
    {
      kind: 'NUMERIC',
      prompt: 'If 6 pens cost ₹90, what do 10 pens cost, in rupees?',
      answer: '150',
      explanation: 'Direct proportion: one pen costs 15, so 10 cost 150.',
    },
    {
      kind: 'NUMERIC',
      prompt: '12 workers finish a wall in 10 days. How many days would 8 workers take?',
      answer: '15',
      explanation:
        'Inverse proportion: 12 × 10 = 8 × d, so d = 120/8 = 15.',
      difficulty: 2,
      marks: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'In a direct proportion between x and y, which quantity stays constant?',
      options: ['x + y', 'x − y', 'x/y', 'x × y'],
      answer: '2',
      explanation: 'In direct proportion x/y is constant; in inverse proportion x × y is constant.',
      difficulty: 2,
    },
  ],

  'maths:14': [
    {
      kind: 'MCQ',
      prompt: 'Factorise x² − 9.',
      options: ['(x − 3)²', '(x − 3)(x + 3)', '(x − 9)(x + 1)', 'x(x − 9)'],
      answer: '1',
      explanation: 'This is a difference of two squares: a² − b² = (a − b)(a + b).',
    },
    {
      kind: 'MCQ',
      prompt: 'What is the HCF of the terms 12x²y and 18xy² ?',
      options: ['6xy', '6x²y²', '36xy', '2xy'],
      answer: '0',
      explanation: 'HCF of 12 and 18 is 6; the lowest power of x is 1 and of y is 1.',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'Factorise x² + 5x + 6.',
      options: ['(x + 1)(x + 6)', '(x + 2)(x + 3)', '(x − 2)(x − 3)', '(x + 5)(x + 1)'],
      answer: '1',
      explanation: 'Two numbers that multiply to 6 and add to 5 are 2 and 3.',
      difficulty: 2,
    },
    {
      kind: 'NUMERIC',
      prompt: 'Divide 24x³ by 8x. What is the coefficient of the result?',
      answer: '3',
      explanation: '24x³ ÷ 8x = 3x², whose coefficient is 3.',
    },
  ],

  // -------------------------------------------------- Science, remaining chapters
  'science:2': [
    {
      kind: 'MCQ',
      prompt: 'Which microorganism is used to make curd from milk?',
      options: ['Yeast', 'Lactobacillus', 'Penicillium', 'Amoeba'],
      answer: '1',
      explanation: 'Lactobacillus bacteria turn the lactose in milk into lactic acid, which sets the curd.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these diseases is caused by a virus?',
      options: ['Typhoid', 'Tuberculosis', 'Common cold', 'Malaria'],
      answer: '2',
      explanation:
        'Typhoid and tuberculosis are bacterial; malaria is caused by a protozoan carried by mosquitoes.',
      difficulty: 2,
    },
    {
      kind: 'SHORT',
      prompt:
        'What is the process of preserving food by heating it and then cooling it rapidly called?',
      answer: 'pasteurisation',
    },
    {
      kind: 'MCQ',
      prompt: 'Rhizobium bacteria in the root nodules of pulses are useful because they:',
      options: [
        'Kill insects',
        'Fix nitrogen from the air into the soil',
        'Make the plant grow taller',
        'Produce antibiotics',
      ],
      answer: '1',
      explanation: 'They convert atmospheric nitrogen into a form plants can absorb, enriching the soil.',
    },
  ],

  'science:3': [
    {
      kind: 'MCQ',
      prompt: 'Which fibre is known as artificial silk?',
      options: ['Nylon', 'Rayon', 'Polyester', 'Acrylic'],
      answer: '1',
      explanation: 'Rayon is made from wood pulp, a natural source, but is processed into fibre — hence "artificial silk".',
    },
    {
      kind: 'MCQ',
      prompt: 'Which plastic can be softened by heating and reshaped again and again?',
      options: ['Thermosetting plastic', 'Thermoplastic', 'Bakelite', 'Melamine'],
      answer: '1',
      explanation: 'Polythene and PVC are thermoplastics; bakelite and melamine are thermosetting and cannot be remoulded.',
    },
    {
      kind: 'MCQ',
      prompt: 'Why are plastics called non-biodegradable?',
      options: [
        'They burn easily',
        'They are not broken down by natural processes',
        'They dissolve in water',
        'They conduct electricity',
      ],
      answer: '1',
    },
    {
      kind: 'SHORT',
      prompt:
        'Which synthetic fibre, used to make parachutes and ropes, is stronger than a steel wire of the same thickness?',
      answer: 'nylon',
    },
  ],

  'science:4': [
    {
      kind: 'MCQ',
      prompt: 'Which of these is a non-metal that conducts electricity?',
      options: ['Sulphur', 'Graphite', 'Phosphorus', 'Iodine'],
      answer: '1',
      explanation: 'Graphite is the well-known exception among non-metals — it is used for electrodes.',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'What happens when a more reactive metal is placed in a solution of a less reactive metal’s salt?',
      options: [
        'Nothing happens',
        'The more reactive metal displaces the less reactive one',
        'Both metals dissolve',
        'The solution freezes',
      ],
      answer: '1',
      explanation: 'This is a displacement reaction — iron in copper sulphate solution turns it from blue to green.',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'Metal oxides are generally:',
      options: ['Acidic', 'Basic', 'Neutral', 'Always gases'],
      answer: '1',
      explanation: 'Metal oxides are basic; non-metal oxides are acidic.',
    },
    {
      kind: 'SHORT',
      prompt: 'Which is the only metal that is liquid at room temperature?',
      answer: 'mercury',
    },
  ],

  'science:6': [
    {
      kind: 'MCQ',
      prompt: 'Which part of a candle flame is the hottest?',
      options: ['The dark inner zone', 'The luminous middle zone', 'The outermost zone', 'The wick'],
      answer: '2',
      explanation:
        'The outer zone has the most oxygen, so combustion is complete there — which is why goldsmiths use it.',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'Why is water not used to put out an electrical fire?',
      options: [
        'It is too cold',
        'It conducts electricity and can cause a shock',
        'It makes the fire burn faster',
        'It evaporates too quickly',
      ],
      answer: '1',
    },
    {
      kind: 'SHORT',
      prompt: 'What name is given to the lowest temperature at which a substance catches fire?',
      answer: 'ignition temperature',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is the cleanest fuel among those listed?',
      options: ['Coal', 'Kerosene', 'Hydrogen', 'Wood'],
      answer: '2',
      explanation: 'Burning hydrogen produces only water, and it has the highest calorific value of the four.',
    },
  ],

  'science:8': [
    {
      kind: 'MCQ',
      prompt: 'Which structure is present in a plant cell but absent in an animal cell?',
      options: ['Nucleus', 'Cell wall', 'Cytoplasm', 'Cell membrane'],
      answer: '1',
    },
    {
      kind: 'SHORT',
      prompt: 'What is the jelly-like substance between the nucleus and the cell membrane called?',
      answer: 'cytoplasm',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these organisms is unicellular?',
      options: ['Amoeba', 'Onion', 'Human', 'Frog'],
      answer: '0',
    },
    {
      kind: 'MCQ',
      prompt: 'A cell without a well-defined nucleus is described as:',
      options: ['Eukaryotic', 'Prokaryotic', 'Multicellular', 'Photosynthetic'],
      answer: '1',
      explanation: 'Bacteria are prokaryotes: their genetic material is not enclosed in a nuclear membrane.',
      difficulty: 2,
    },
  ],

  'science:11': [
    {
      kind: 'NUMERIC',
      prompt:
        'A force of 60 N acts on an area of 3 m². What is the pressure, in pascals?',
      answer: '20',
      explanation: 'Pressure = force ÷ area = 60 ÷ 3 = 20 Pa.',
    },
    {
      kind: 'MCQ',
      prompt: 'Why is the bottom of a dam made thicker than its top?',
      options: [
        'To make it look stronger',
        'Because liquid pressure increases with depth',
        'To save material',
        'Because water is colder at the bottom',
      ],
      answer: '1',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is a contact force?',
      options: ['Gravitational force', 'Magnetic force', 'Friction', 'Electrostatic force'],
      answer: '2',
    },
    {
      kind: 'SHORT',
      prompt: 'What is the SI unit of pressure?',
      answer: 'pascal',
    },
  ],

  'science:13': [
    {
      kind: 'MCQ',
      prompt: 'Sound cannot travel through:',
      options: ['Solids', 'Liquids', 'Gases', 'Vacuum'],
      answer: '3',
      explanation: 'Sound needs a material medium to carry the vibration; a vacuum has none.',
    },
    {
      kind: 'MCQ',
      prompt: 'Which property of a sound wave decides how loud the sound is?',
      options: ['Frequency', 'Amplitude', 'Wavelength', 'Speed'],
      answer: '1',
      explanation: 'Amplitude sets loudness; frequency sets pitch.',
    },
    {
      kind: 'MCQ',
      prompt: 'The range of frequencies a healthy human ear can hear is roughly:',
      options: ['2 Hz to 200 Hz', '20 Hz to 20,000 Hz', '200 Hz to 2,000 Hz', '0 Hz to 100 Hz'],
      answer: '1',
      difficulty: 2,
    },
    {
      kind: 'SHORT',
      prompt: 'What is the SI unit of frequency?',
      answer: 'hertz',
    },
  ],

  'science:16': [
    {
      kind: 'MCQ',
      prompt: 'A ray of light strikes a mirror at an angle of incidence of 35°. What is the angle of reflection?',
      options: ['35°', '55°', '70°', '90°'],
      answer: '0',
      explanation: 'The law of reflection: the angle of reflection equals the angle of incidence.',
    },
    {
      kind: 'MCQ',
      prompt: 'The image formed by a plane mirror is:',
      options: [
        'Real, inverted and the same size',
        'Virtual, erect and laterally inverted',
        'Real, erect and magnified',
        'Virtual, inverted and diminished',
      ],
      answer: '1',
      difficulty: 2,
    },
    {
      kind: 'SHORT',
      prompt: 'Which part of the eye controls the amount of light entering it?',
      answer: 'iris',
      explanation:
        'The iris is the coloured ring; it changes the size of the pupil, which is the opening light passes through.',
    },
    {
      kind: 'MCQ',
      prompt: 'Reflection from a rough surface, which scatters light in many directions, is called:',
      options: ['Regular reflection', 'Diffused reflection', 'Refraction', 'Dispersion'],
      answer: '1',
    },
  ],

  'science:18': [
    {
      kind: 'MCQ',
      prompt: 'Which gas is chiefly responsible for the greenhouse effect being stronger than it once was?',
      options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Argon'],
      answer: '2',
    },
    {
      kind: 'MCQ',
      prompt: 'The Taj Mahal is being damaged mainly by:',
      options: [
        'Acid rain from sulphur dioxide and nitrogen dioxide',
        'Excess rainfall',
        'Strong winds',
        'Groundwater'
      ],
      answer: '0',
      explanation:
        'Acidic gases from nearby industry react with the marble, a process often called marble cancer.',
      difficulty: 2,
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these best describes potable water?',
      options: [
        'Water that looks clear',
        'Water that is fit to drink',
        'Water used in industry',
        'Water from a river',
      ],
      answer: '1',
    },
    {
      kind: 'MCQ',
      prompt: 'Which of these is the best example of reducing water pollution at its source?',
      options: [
        'Boiling water before drinking it',
        'Treating factory waste before it is released into a river',
        'Storing water in a covered tank',
        'Filtering water at home',
      ],
      answer: '1',
      explanation:
        'The first, third and fourth make water safe for one household. Only treatment before discharge stops the river being polluted at all.',
      difficulty: 2,
    },
  ],
}
