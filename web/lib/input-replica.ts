export const INPUT_REPLICA_STEPS = [
  {
    title: 'Escucha activa',
    seconds: 300,
    instruction:
      'Elige un video, entrevista o podcast real en inglés y escúchalo durante 5 minutos, sin subtítulos en español. Identifica el argumento principal. Abre el material en otra pestaña y vuelve aquí para controlar el tiempo.',
  },
  {
    title: 'Síntesis del argumento',
    seconds: 180,
    instruction:
      'Pausa el material y explica en voz alta, en inglés y con tus propias palabras, qué dijo la persona y cuál es su argumento. No leas una transcripción.',
  },
  {
    title: 'Postura y contraste',
    seconds: 180,
    instruction:
      'Responde al argumento en voz alta: ¿estás de acuerdo o en desacuerdo? Explica por qué y contrástalo con una experiencia propia.',
  },
  {
    title: 'Aplicación con PREP',
    seconds: 240,
    instruction:
      'Desarrolla tu respuesta en inglés con PREP: punto, razón, ejemplo y cierre. Usa un ejemplo real o hipotético conectado con lo que escuchaste.',
  },
];

export type InputClock = {
  index: number;
  remaining: number;
  deadline: number | null;
  finished: boolean;
};
export const initialInputClock: InputClock = {
  index: 0,
  remaining: 300,
  deadline: null,
  finished: false,
};
type Action =
  | { type: 'start' | 'pause' | 'tick'; now: number }
  | { type: 'next' }
  | { type: 'reset' };

export function inputClock(state: InputClock, action: Action): InputClock {
  if (action.type === 'reset')
    return {
      ...state,
      remaining: INPUT_REPLICA_STEPS[state.index].seconds,
      deadline: null,
      finished: false,
    };
  if (state.finished) return state;
  if (action.type === 'next') {
    if (state.index === INPUT_REPLICA_STEPS.length - 1)
      return { ...state, deadline: null, finished: true };
    return {
      index: state.index + 1,
      remaining: INPUT_REPLICA_STEPS[state.index + 1].seconds,
      deadline: null,
      finished: false,
    };
  }
  if (action.type === 'start')
    return state.deadline !== null || state.remaining === 0
      ? state
      : { ...state, deadline: action.now + state.remaining * 1000 };
  const remaining =
    state.deadline === null
      ? state.remaining
      : Math.max(0, Math.ceil((state.deadline - action.now) / 1000));
  return {
    ...state,
    remaining,
    deadline: action.type === 'pause' || remaining === 0 ? null : state.deadline,
  };
}
