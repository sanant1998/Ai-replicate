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
}
